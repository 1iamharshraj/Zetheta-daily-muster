'use server';
import { refresh } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionUser, actionHr } from '@/lib/auth';
import { audit, dbNow } from '@/lib/data';
import { METRICS } from '@/lib/constants';
import { rid } from '@/lib/day';
import { notifyPerson } from '@/lib/notify';
import type { SeniorStatus, Target } from '@/lib/db/schema';

type R = { ok?: string; error?: string };
const isMon = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k) && new Date(k + 'T00:00:00Z').getUTCDay() === 1;

async function upsertWeek(personId: number, monday: string, patch: Partial<typeof t.weeks.$inferInsert>) {
  await db.insert(t.weeks).values({ personId, monday, ...patch })
    .onConflictDoUpdate({ target: [t.weeks.personId, t.weeks.monday], set: patch });
}
async function getTargets(personId: number, monday: string) {
  const r = await db.select().from(t.weeks).where(and(eq(t.weeks.personId, personId), eq(t.weeks.monday, monday))).limit(1);
  return r[0]?.targets || [];
}

export async function addTarget(monday: string, text: string, metric: string | null, goal: number): Promise<R> {
  const me = await actionUser();
  if (!isMon(monday)) return { error: 'Pick a week.' };
  text = String(text || '').trim().slice(0, 160);
  if (!text) return { error: 'Describe the target first.' };
  if (metric && (!METRICS[metric] || !me.metrics.includes(metric))) metric = null;
  const tg = await getTargets(me.id, monday);
  if (tg.length >= 8) return { error: 'Keep it to 3–5 targets a week.' };
  tg.push({ id: rid(), text, metric: metric || null, goal: Math.max(1, Math.floor(+goal || 1)), done: 0 });
  await upsertWeek(me.id, monday, { targets: tg });
  refresh();
  return {};
}

export async function stepTarget(monday: string, id: string, d: number): Promise<R> {
  const me = await actionUser();
  const tg: Target[] = (await getTargets(me.id, monday)).map((x) => (x.id === id ? { ...x, done: Math.max(0, (+x.done || 0) + (d > 0 ? 1 : -1)) } : x));
  await upsertWeek(me.id, monday, { targets: tg });
  refresh();
  return {};
}

export async function deleteTarget(monday: string, id: string): Promise<R> {
  const me = await actionUser();
  await upsertWeek(me.id, monday, { targets: (await getTargets(me.id, monday)).filter((x) => x.id !== id) });
  refresh();
  return {};
}

export async function saveSelfReview(monday: string, text: string): Promise<R> {
  const me = await actionUser();
  if (!isMon(monday)) return { error: 'Pick a week.' };
  await upsertWeek(me.id, monday, { selfReview: String(text || '').trim().slice(0, 1200) });
  refresh();
  return { ok: 'Review saved.' };
}

/** WK-6 / TEAM-5: HR sets status and comment on someone's week. */
export async function setSenior(personId: number, monday: string, status: SeniorStatus | null | undefined, comment?: string): Promise<R> {
  const me = await actionHr();
  if (!isMon(monday)) return { error: 'Pick a week.' };
  const patch: Partial<typeof t.weeks.$inferInsert> = { seniorBy: me.id, seniorAt: (await dbNow()).toISOString() };
  if (status !== undefined) patch.seniorStatus = status && ['track', 'push', 'off'].includes(status) ? status : null;
  if (comment !== undefined) patch.seniorComment = String(comment).trim().slice(0, 1200);
  await upsertWeek(personId, monday, patch);
  await audit(me.id, 'week.feedback', personId, { monday, status, comment });
  if (comment) await notifyPerson(personId, 'New feedback on your week', comment, '/goals');
  refresh();
  return comment !== undefined ? { ok: 'Feedback sent. They’ll see it on their Weekly goals page.' } : {};
}
