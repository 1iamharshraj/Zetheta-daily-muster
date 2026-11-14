import 'server-only';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, t } from './db';
import type { DayLog } from './data';
import type { Task } from './db/schema';

/** Copy of an open task for carry-over; keeps who assigned it. */
export const carryTask = (x: Task): Task => ({
  id: Math.random().toString(36).slice(2, 9), text: x.text, status: x.status, carried: true,
  ...(x.assignedBy ? { assignedBy: x.assignedBy, assignedByName: x.assignedByName, assignedAt: x.assignedAt } : {}),
});

export type DayPatch = Partial<Omit<typeof t.dayLogs.$inferInsert, 'personId' | 'date'>>;

export async function getDay(personId: number, date: string): Promise<DayLog | null> {
  const r = await db.select().from(t.dayLogs).where(and(eq(t.dayLogs.personId, personId), eq(t.dayLogs.date, date))).limit(1);
  return r[0] || null;
}

export async function upsertDay(personId: number, date: string, patch: DayPatch) {
  await db.insert(t.dayLogs).values({ personId, date, ...patch })
    .onConflictDoUpdate({ target: [t.dayLogs.personId, t.dayLogs.date], set: { ...patch, updatedAt: new Date() } });
}

/** The live (pending/approved) leave on a date, if any. */
export async function liveLeaveOn(personId: number, date: string) {
  const r = await db.select().from(t.leaves)
    .where(and(eq(t.leaves.personId, personId), eq(t.leaves.date, date), inArray(t.leaves.status, ['pending', 'approved']))).limit(1);
  return r[0] || null;
}

/** HOME-6: open tasks from the most recent earlier day that had a plan. */
export async function carryCandidates(personId: number, before: string) {
  const r = await db.select({ date: t.dayLogs.date, plan: t.dayLogs.plan }).from(t.dayLogs)
    .where(and(eq(t.dayLogs.personId, personId), lt(t.dayLogs.date, before), sql`jsonb_array_length(${t.dayLogs.plan}) > 0`))
    .orderBy(desc(t.dayLogs.date)).limit(1);
  if (!r[0]) return { from: null as string | null, items: [] as Task[] };
  return { from: r[0].date, items: r[0].plan.filter((x) => x.status !== 'done') };
}

/** Snapshot of the columns a past-day edit may change, so HR can reject (revert) it. */
export const snapshot = (d: DayLog | null) => d ? {
  mode: d.mode, checkInAt: d.checkInAt, checkInSrc: d.checkInSrc, checkOutAt: d.checkOutAt, checkOutSrc: d.checkOutSrc,
  meetingNote: d.meetingNote, eod: d.eod, lateMins: d.lateMins, lateStatus: d.lateStatus, intent: d.intent,
} : {
  mode: null, checkInAt: null, checkInSrc: null, checkOutAt: null, checkOutSrc: null, meetingNote: null, eod: null, lateMins: null, lateStatus: null, intent: null,
};

export const rid = () => Math.random().toString(36).slice(2, 9);
