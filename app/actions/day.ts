'use server';
import { refresh } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { dbNow, getSettings } from '@/lib/data';
import { getDay, upsertDay, liveLeaveOn, carryCandidates, snapshot, rid } from '@/lib/day';
import { computeLate, isWorkday } from '@/lib/rules';
import { keyOf, tLabel, isoAt, hm2m, minsOf, addD, addMonth, monthOf, fmtShort } from '@/lib/time';
import { METRICS } from '@/lib/constants';
import type { Mode, Task, TaskStatus, LeaveKind } from '@/lib/db/schema';
import { notifyHr } from '@/lib/notify';
import { shortName } from '@/lib/names';

type R = { ok?: string; error?: string };
const WORK: Mode[] = ['office', 'wfh', 'remote', 'meeting'];
const modesFor = (type: string): Mode[] => (type === 'remote' ? ['remote', 'meeting'] : ['office', 'wfh', 'meeting']);

async function ctx() {
  const me = await actionUser();
  const now = await dbNow();
  return { me, now, today: keyOf(now), nowIso: now.toISOString() };
}

/* ---------- clock ---------- */

export async function clockIn(mode: Mode, note: string): Promise<R> {
  const { me, now, today, nowIso } = await ctx();
  if (!modesFor(me.type).includes(mode)) return { error: 'Pick where you’re working today.' };
  note = String(note || '').trim().slice(0, 120);
  if (mode === 'meeting' && !note) return { error: 'Say where the meeting or event is, and with whom.' };
  const day = await getDay(me.id, today);
  if (day?.checkInAt) return { error: 'You’re already clocked in today.' };
  const lv = await liveLeaveOn(me.id, today);
  if (lv && !lv.half) return { error: 'You’re on leave today. Cancel the leave first if you’re working.' };
  const s = await getSettings();
  const late = computeLate(s, me, today, mode, nowIso);
  let plan = day?.plan || [];
  if (!plan.length) {
    const cf = await carryCandidates(me.id, today);
    plan = cf.items.map((x) => ({ id: rid(), text: x.text, status: x.status as TaskStatus, carried: true }));
  }
  await upsertDay(me.id, today, { mode, checkInAt: nowIso, checkInSrc: 'server', meetingNote: mode === 'meeting' ? note : null, plan, intent: null, ...late });
  refresh();
  const lateMsg = late.lateStatus === 'severe' ? ` That’s ${late.lateMins} min late: half a day is cut.` : late.lateStatus === 'late' ? ` That’s ${late.lateMins} min late: a late mark.` : '';
  return { ok: `Clocked in at ${tLabel(now.toISOString())}.${lateMsg} Next: add today’s tasks.` };
}

export async function clockOut(summary: string): Promise<R> {
  const { me, now, today, nowIso } = await ctx();
  summary = String(summary || '').trim().slice(0, 1200);
  if (summary.length < 10) return { error: 'Write a short summary of the day first (at least a sentence).' };
  const day = await getDay(me.id, today);
  if (!day?.checkInAt) return { error: 'You haven’t clocked in today.' };
  if (day.checkOutAt) return { error: 'You’ve already clocked out.' };
  await upsertDay(me.id, today, { eod: summary, checkOutAt: nowIso, checkOutSrc: 'server' });
  refresh();
  return { ok: `Clocked out at ${tLabel(now.toISOString())}. Good work today.` };
}

export async function saveSummary(summary: string): Promise<R> {
  const { me, today } = await ctx();
  summary = String(summary || '').trim().slice(0, 1200);
  if (summary.length < 10) return { error: 'Write at least a sentence.' };
  await upsertDay(me.id, today, { eod: summary });
  refresh();
  return { ok: 'Summary saved.' };
}

/* ---------- tasks ---------- */

async function editPlan(fn: (plan: Task[]) => Task[]) {
  const { me, today } = await ctx();
  const day = await getDay(me.id, today);
  const plan = fn([...(day?.plan || [])]);
  await upsertDay(me.id, today, { plan });
  refresh();
}

export async function addTask(text: string): Promise<R> {
  text = String(text || '').trim().slice(0, 200);
  if (!text) return { error: 'Type the task first.' };
  await editPlan((p) => (p.length >= 30 ? p : [...p, { id: rid(), text, status: 'todo' }]));
  return {};
}
export async function setTaskStatus(id: string, status: TaskStatus): Promise<R> {
  if (!['todo', 'doing', 'hold', 'blocked', 'done'].includes(status)) return { error: 'Unknown status.' };
  await editPlan((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
  return {};
}
export async function deleteTask(id: string): Promise<R> {
  await editPlan((p) => p.filter((x) => x.id !== id));
  return {};
}
export async function carryOver(): Promise<R> {
  const { me, today } = await ctx();
  const cf = await carryCandidates(me.id, today);
  if (!cf.items.length) return { error: 'Nothing to carry over.' };
  await editPlan((p) => [...p, ...cf.items.map((x) => ({ id: rid(), text: x.text, status: x.status as TaskStatus, carried: true }))]);
  return { ok: `Brought ${cf.items.length} open task${cf.items.length > 1 ? 's' : ''} from ${fmtShort(cf.from!)}.` };
}

/* ---------- numbers & blocker ---------- */

export async function setMetric(m: string, v: number): Promise<R> {
  const { me, today } = await ctx();
  if (!METRICS[m] || !me.metrics.includes(m)) return { error: 'That number isn’t tracked for you.' };
  const n = Math.max(0, Math.min(100000, Math.floor(+v || 0)));
  const day = await getDay(me.id, today);
  await upsertDay(me.id, today, { metrics: { ...(day?.metrics || {}), [m]: n } });
  refresh();
  return {};
}

export async function setBlocker(text: string): Promise<R> {
  const { me, today, nowIso } = await ctx();
  text = String(text || '').trim().slice(0, 400);
  if (!text) return { error: 'Describe what you’re stuck on first.' };
  await upsertDay(me.id, today, { blocker: { text, at: nowIso } });
  refresh();
  return { ok: 'Blocker flagged. The senior can see it now.' };
}
export async function resolveBlocker(): Promise<R> {
  const { me, today, nowIso } = await ctx();
  const day = await getDay(me.id, today);
  if (day?.blocker) await upsertDay(me.id, today, { blocker: { ...day.blocker, resolved: true, at: nowIso } });
  refresh();
  return { ok: 'Marked resolved.' };
}

/* ---------- leave (LV-2..4, v2: HR approves) ---------- */

export async function applyLeave(input: { from: string; to: string; half: boolean; kind: LeaveKind; reason: string }): Promise<R> {
  const { me, today, nowIso } = await ctx();
  const s = await getSettings();
  const { from, half } = input;
  const to = input.to || from;
  const kind: LeaveKind = ['casual', 'earned', 'lwp'].includes(input.kind) ? input.kind : 'casual';
  const reason = String(input.reason || '').trim().slice(0, 160);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < today) return { error: 'Pick today or a later start date.' };
  if (to < from) return { error: 'The end date is before the start date.' };
  if (half && to !== from) return { error: 'A half day can only be a single date.' };
  const days: string[] = [];
  for (let k = from, j = 0; k <= to && j < 62; k = addD(k, 1), j++) if (isWorkday(s, k)) days.push(k);
  if (!days.length) return { error: 'No working days in that range.' };
  const [logs, live] = await Promise.all([
    db.select().from(t.dayLogs).where(and(eq(t.dayLogs.personId, me.id), inArray(t.dayLogs.date, days))),
    db.select().from(t.leaves).where(and(eq(t.leaves.personId, me.id), inArray(t.leaves.date, days), inArray(t.leaves.status, ['pending', 'approved']))),
  ]);
  const skip = new Set([...live.map((l) => l.date), ...(half ? [] : logs.filter((l) => l.checkInAt).map((l) => l.date))]);
  const ks = days.filter((k) => !skip.has(k));
  if (!ks.length) return { error: 'You already have leave or a check-in on those days.' };
  await db.insert(t.leaves).values(ks.map((date) => ({ personId: me.id, date, half, kind, reason, appliedAt: nowIso, status: 'pending' as const })));
  await notifyHr('leave', `${shortName(me.fullName)} applied for leave`, `${ks.length} day${ks.length > 1 ? 's' : ''} from ${fmtShort(ks[0])}${reason ? ': ' + reason : ''}`, '/hr');
  refresh();
  const unplanned = keyOf(nowIso) >= ks[0];
  return { ok: `Leave requested for ${ks.length} working day${ks.length > 1 ? 's' : ''}. HR will approve it.${unplanned ? ' Same-day leave counts as unplanned.' : ''}` };
}

export async function cancelLeave(id: number): Promise<R> {
  const { me, today } = await ctx();
  const lv = (await db.select().from(t.leaves).where(and(eq(t.leaves.id, id), eq(t.leaves.personId, me.id))).limit(1))[0];
  if (!lv || !['pending', 'approved'].includes(lv.status)) return { error: 'That leave can’t be cancelled.' };
  if (lv.date < today) return { error: 'Past leave can’t be cancelled. Ask HR.' };
  if (lv.date === today && (await getDay(me.id, today))?.checkInAt && !lv.half) return { error: 'Past leave can’t be cancelled. Ask HR.' };
  await db.update(t.leaves).set({ status: 'cancelled' }).where(eq(t.leaves.id, id));
  refresh();
  return { ok: 'Leave cancelled.' };
}

/* ---------- day editor (ATT-4) ---------- */

export type EditInput = { k: string; st: string; ci?: string; co?: string; note?: string; sum?: string; reason?: string; kind?: LeaveKind };

export async function editDay(v: EditInput): Promise<R> {
  const { me, today, nowIso } = await ctx();
  const s = await getSettings();
  const k = v.k, st = v.st, fut = k > today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < addMonth(monthOf(today), -1) + '-01' || k > addD(today, 90)) return { error: 'That day can’t be changed any more. Ask HR.' };
  const day = await getDay(me.id, k);
  const lv = await liveLeaveOn(me.id, k);
  const srvIn = day?.checkInSrc === 'server' && !!day.checkInAt;
  const srvOut = day?.checkOutSrc === 'server' && !!day.checkOutAt;
  const reason = String(v.reason || '').trim().slice(0, 160);
  const note = String(v.note || '').trim().slice(0, 120);
  const edit = (r: string) => ({ reason: r, by: me.id, at: nowIso, status: 'pending' as const, prev: snapshot(day) });
  const kind: LeaveKind = v.kind && ['casual', 'earned', 'lwp'].includes(v.kind) ? v.kind : 'casual';

  const cancelLive = async () => { if (lv) await db.update(t.leaves).set({ status: 'cancelled' }).where(eq(t.leaves.id, lv.id)); };
  const requestLeave = async (half: boolean) => {
    if (lv && lv.half === half) { await db.update(t.leaves).set({ reason: reason || lv.reason, kind }).where(eq(t.leaves.id, lv.id)); return; }
    await cancelLive();
    await db.insert(t.leaves).values({ personId: me.id, date: k, half, kind, reason, appliedAt: nowIso, status: 'pending' });
    await notifyHr('leave', `${shortName(me.fullName)} applied for leave`, `${half ? 'Half day' : 'Full day'} on ${fmtShort(k)}${reason ? ': ' + reason : ''}`, '/hr');
  };

  if (!st) return { error: 'Pick a status first.' };
  if (st === 'none') {
    if (lv && lv.date < today) return { error: 'Past leave can’t be removed here. Ask HR.' };
    await cancelLive();
    const p: Parameters<typeof upsertDay>[2] = { intent: null, meetingNote: srvIn ? day?.meetingNote : null };
    if (!srvIn) Object.assign(p, { checkInAt: null, checkInSrc: null, checkOutAt: null, checkOutSrc: null, mode: null, lateMins: null, lateStatus: null });
    if (!fut && day?.checkInAt && !srvIn) p.edit = edit('Cleared the day');
    await upsertDay(me.id, k, p);
  } else if (st === 'leave' || (fut && st === 'half')) {
    if (!isWorkday(s, k)) return { error: `${fmtShort(k)} isn’t a working day, so no leave is needed.` };
    if (srvIn && st === 'leave') return { error: 'You clocked in that day. Pick Half day instead.' };
    await requestLeave(st === 'half');
    const p: Parameters<typeof upsertDay>[2] = { intent: null };
    if (!fut && day?.checkInAt && st === 'leave') Object.assign(p, { checkInAt: null, checkInSrc: null, checkOutAt: null, checkOutSrc: null, mode: null, lateMins: null, lateStatus: null, edit: edit(reason || 'Marked as leave') });
    await upsertDay(me.id, k, p);
  } else if (fut) {
    if (!WORK.includes(st as Mode)) return { error: 'Pick a status first.' };
    if (st === 'meeting' && !note) return { error: 'Say where the meeting or event will be.' };
    await cancelLive();
    await upsertDay(me.id, k, { intent: st as Mode, meetingNote: st === 'meeting' ? note : null });
  } else {
    if (k === today && !day?.checkInAt) return { error: 'Today is recorded live: use Clock in on Home.' };
    const mode: Mode = st === 'half' ? (day?.mode || (me.type === 'remote' ? 'remote' : 'office')) : (st as Mode);
    if (!WORK.includes(mode)) return { error: 'Pick a status first.' };
    if (st === 'meeting' && !note) return { error: 'Say where the meeting or event was.' };
    if (!srvIn && !v.ci) return { error: 'Enter the time you started.' };
    if (!srvIn && v.ci && v.co && hm2m(v.co) <= hm2m(v.ci)) return { error: 'Finish time must be after the start time.' };
    if (srvIn && !srvOut && v.co && hm2m(v.co) <= minsOf(day!.checkInAt!)) return { error: 'Finish time must be after the start time.' };
    if (!reason) return { error: 'Add a short reason for the change.' };
    const p: Parameters<typeof upsertDay>[2] = { mode, intent: null, edit: edit(reason), meetingNote: st === 'meeting' ? note : day?.meetingNote ?? null };
    const ciAt = srvIn ? day!.checkInAt! : isoAt(k, v.ci!);
    if (!srvIn) Object.assign(p, { checkInAt: ciAt, checkInSrc: 'manual' });
    if (!srvOut) Object.assign(p, { checkOutAt: v.co ? isoAt(k, v.co) : null, checkOutSrc: v.co ? 'manual' : null });
    Object.assign(p, computeLate(s, me, k, mode, ciAt));
    if (String(v.sum || '').trim()) p.eod = String(v.sum).trim().slice(0, 1200);
    if (st === 'half') { if (isWorkday(s, k)) await requestLeave(true); } else if (lv && lv.half) await cancelLive();
    else if (lv && !lv.half) await cancelLive();
    await upsertDay(me.id, k, p);
    if (p.edit) await notifyHr('edit', `${shortName(me.fullName)} edited ${fmtShort(k)}`, reason, '/hr');
  }
  refresh();
  return { ok: fut ? 'Saved to your plan.' : 'Saved. HR can see this change.' };
}
