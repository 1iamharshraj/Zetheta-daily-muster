import 'server-only';
import { and, eq, gte, lte, inArray, ne, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db, t } from './db';
import { withDefaults, type Settings } from './settings';
import type { Days, DayRec, LeaveLite } from './rules';
import { byName } from './names';
import { keyOf } from './time';

export type Person = typeof t.people.$inferSelect;
export type DayLog = typeof t.dayLogs.$inferSelect;
export type Week = typeof t.weeks.$inferSelect;
export type HrRecord = typeof t.hrRecords.$inferSelect;

/** IST "today" from the database clock (R1: never trust the device). */
export const dbNow = cache(async () => {
  const r = await db.execute<{ now: string }>(sql`select now()::text as now`);
  return new Date(r.rows[0].now);
});
export const today = cache(async () => keyOf(await dbNow()));

export const getSettings = cache(async (): Promise<Settings> => {
  const r = await db.select().from(t.appConfig).where(eq(t.appConfig.key, 'settings')).limit(1);
  return withDefaults(r[0]?.value as Partial<Settings>);
});

export const getConfig = async <T,>(key: string, fallback: T): Promise<T> => {
  const r = await db.select().from(t.appConfig).where(eq(t.appConfig.key, key)).limit(1);
  return (r[0]?.value as T) ?? fallback;
};
export const setConfig = async (key: string, value: unknown) => {
  await db.insert(t.appConfig).values({ key, value }).onConflictDoUpdate({ target: t.appConfig.key, set: { value, updatedAt: new Date() } });
};

/** Everyone, sorted A–Z by display name. Strips secrets. */
export const getPeople = cache(async () => {
  const rows = await db.select().from(t.people);
  return rows.map(publicPerson).sort(byName);
});
export type PublicPerson = ReturnType<typeof publicPerson>;
export function publicPerson(p: Person) {
  const { passwordHash, totpSecret, ...rest } = p;
  return { ...rest, hasAccount: !!passwordHash };
}
export const team = async () => (await getPeople()).filter((p) => p.status === 'active');

const toLeave = (l: typeof t.leaves.$inferSelect): LeaveLite => ({
  id: l.id, half: l.half, kind: l.kind, appliedAt: l.appliedAt, status: l.status, source: l.source, reason: l.reason,
});

/** Day records (logs + live leave merged) for a set of people in a date range. */
export async function loadDays(personIds: number[], from: string, to: string) {
  const out = new Map<number, Days>();
  personIds.forEach((id) => out.set(id, {}));
  if (!personIds.length) return out;
  const [logs, lvs] = await Promise.all([
    db.select().from(t.dayLogs).where(and(inArray(t.dayLogs.personId, personIds), gte(t.dayLogs.date, from), lte(t.dayLogs.date, to))),
    db.select().from(t.leaves).where(and(inArray(t.leaves.personId, personIds), gte(t.leaves.date, from), lte(t.leaves.date, to), inArray(t.leaves.status, ['pending', 'approved']))),
  ]);
  for (const l of logs) out.get(l.personId)![l.date] = { ...(l as unknown as DayRec), date: l.date };
  for (const l of lvs) {
    const m = out.get(l.personId)!;
    m[l.date] = { ...(m[l.date] || { date: l.date }), leave: toLeave(l) };
  }
  return out;
}

export async function getLeaves(personIds: number[], from: string, to: string, statuses?: string[]) {
  if (!personIds.length) return [];
  const conds = [inArray(t.leaves.personId, personIds), gte(t.leaves.date, from), lte(t.leaves.date, to)];
  if (statuses) conds.push(inArray(t.leaves.status, statuses as never[]));
  return db.select().from(t.leaves).where(and(...conds)).orderBy(t.leaves.date);
}

export async function getWeeks(personIds: number[], monday: string) {
  if (!personIds.length) return new Map<number, Week>();
  const rows = await db.select().from(t.weeks).where(and(inArray(t.weeks.personId, personIds), eq(t.weeks.monday, monday)));
  return new Map(rows.map((w) => [w.personId, w]));
}

export async function getHr(personId: number) {
  const r = await db.select().from(t.hrRecords).where(eq(t.hrRecords.personId, personId)).limit(1);
  return r[0] || null;
}
export async function getAllHr() {
  const r = await db.select().from(t.hrRecords);
  return new Map(r.map((x) => [x.personId, x]));
}

export async function audit(actorId: number | null, action: string, targetId: number | null, detail?: unknown) {
  await db.insert(t.auditLog).values({ actorId, action, targetId, detail: detail ?? null });
}

export const notMe = (id: number) => ne(t.people.id, id);
