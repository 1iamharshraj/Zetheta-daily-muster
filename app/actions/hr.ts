'use server';
import { refresh } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionHr } from '@/lib/auth';
import { audit, dbNow, getSettings } from '@/lib/data';
import { getDay, upsertDay, liveLeaveOn } from '@/lib/day';
import { computeLate } from '@/lib/rules';
import { fmtShort, hm2m, isoAt } from '@/lib/time';
import { notifyPerson } from '@/lib/notify';
import type { LeaveKind, Mode } from '@/lib/db/schema';

type R = { ok?: string; error?: string };
const person = async (id: number) => (await db.select().from(t.people).where(eq(t.people.id, id)).limit(1))[0];

/** Spot check: 'no' turns an office check-in into an absence. */
export async function spotCheck(personId: number, k: string, v: 'yes' | 'no' | null): Promise<R> {
  const me = await actionHr();
  await upsertDay(personId, k, { spot: v });
  await audit(me.id, 'day.spot', personId, { k, v });
  refresh();
  return { ok: v ? 'Spot check recorded.' : 'Spot check cleared.' };
}

export async function excuseLate(personId: number, k: string, on: boolean): Promise<R> {
  const me = await actionHr();
  await upsertDay(personId, k, { lateExcused: on });
  await audit(me.id, 'day.excuse', personId, { k, on });
  refresh();
  return { ok: on ? 'Late mark excused.' : 'Excuse removed.' };
}

/** HR correction of check-in/out and mode. Late status is recomputed from the corrected time. */
export async function correctDay(personId: number, k: string, mode: Mode, ci: string, co: string): Promise<R> {
  const me = await actionHr();
  if (!ci) return { error: 'Enter a check-in time.' };
  if (co && hm2m(co) <= hm2m(ci)) return { error: 'Check-out must be after check-in.' };
  const p = await person(personId);
  if (!p) return { error: 'Person not found.' };
  const s = await getSettings();
  const prev = await getDay(personId, k);
  const at = isoAt(k, ci);
  await upsertDay(personId, k, {
    mode, checkInAt: at, checkInSrc: 'hr', checkOutAt: co ? isoAt(k, co) : null, checkOutSrc: co ? 'hr' : null,
    ...computeLate(s, p, k, mode, at), edit: prev?.edit?.status === 'pending' ? { ...prev.edit, status: 'approved', decidedBy: me.id, decidedAt: new Date().toISOString() } : prev?.edit ?? null,
  });
  await audit(me.id, 'day.correct', personId, { k, mode, ci, co, prev: prev ? { in: prev.checkInAt, out: prev.checkOutAt, mode: prev.mode } : null });
  refresh();
  return { ok: 'Correction saved.' };
}

/** HR-4: convert an absence to leave. */
export async function markAbsenceLeave(personId: number, k: string, planned: boolean, kind: LeaveKind = 'casual'): Promise<R> {
  const me = await actionHr();
  if (await liveLeaveOn(personId, k)) return { error: 'There’s already leave on that day.' };
  const now = (await dbNow()).toISOString();
  await db.insert(t.leaves).values({
    personId, date: k, half: false, kind, reason: 'Marked by HR', appliedAt: now, status: 'approved',
    source: planned ? 'hr' : 'employee', decidedBy: me.id, decidedAt: now,
  });
  await audit(me.id, 'leave.mark', personId, { k, planned, kind });
  refresh();
  return { ok: planned ? 'Marked as approved leave.' : 'Marked as unplanned leave.' };
}

/** LV-6 / v2 P1: approve or reject a leave request, with an optional comment. */
export async function decideLeave(ids: number[], approve: boolean, comment = ''): Promise<R> {
  const me = await actionHr();
  if (!ids.length) return {};
  const rows = await db.select().from(t.leaves).where(and(inArray(t.leaves.id, ids), eq(t.leaves.status, 'pending')));
  if (!rows.length) return { error: 'Already decided.' };
  const now = (await dbNow()).toISOString();
  await db.update(t.leaves).set({ status: approve ? 'approved' : 'rejected', decidedBy: me.id, decidedAt: now, hrComment: comment.trim().slice(0, 300) || null })
    .where(inArray(t.leaves.id, rows.map((r) => r.id)));
  await audit(me.id, approve ? 'leave.approve' : 'leave.reject', rows[0].personId, { ids: rows.map((r) => r.id), comment });
  const byPerson = new Map<number, string[]>();
  rows.forEach((r) => byPerson.set(r.personId, [...(byPerson.get(r.personId) || []), r.date]));
  for (const [pid, ds] of byPerson) {
    await notifyPerson(pid, `Leave ${approve ? 'approved' : 'rejected'}`, `${ds.length > 1 ? ds.length + ' days from ' : ''}${fmtShort(ds.sort()[0])}${comment ? ' · HR: ' + comment : ''}`, '/leave');
  }
  refresh();
  return { ok: approve ? 'Leave approved.' : 'Leave rejected. They’ve been told.' };
}

/** HR-5: accept a past-day edit, or reject it and restore what was there before. */
export async function decideEdit(personId: number, k: string, approve: boolean): Promise<R> {
  const me = await actionHr();
  const day = await getDay(personId, k);
  if (!day?.edit || day.edit.status !== 'pending') return { error: 'Nothing to review.' };
  const decided = { ...day.edit, status: approve ? 'approved' as const : 'rejected' as const, decidedBy: me.id, decidedAt: new Date().toISOString() };
  if (approve) await upsertDay(personId, k, { edit: decided });
  else await upsertDay(personId, k, { ...(day.edit.prev || {}), edit: decided } as Parameters<typeof upsertDay>[2]);
  await audit(me.id, approve ? 'edit.approve' : 'edit.reject', personId, { k, reason: day.edit.reason });
  if (!approve) await notifyPerson(personId, 'Attendance change not accepted', `Your change to ${fmtShort(k)} was reverted by HR.`, '/attendance');
  refresh();
  return { ok: approve ? 'Change accepted.' : 'Change rejected and reverted.' };
}
