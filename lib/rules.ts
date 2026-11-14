/**
 * The rules engine (PRD §7). Pure functions, ported from v1 so behaviour matches the pilot.
 * Used by every screen and by the CSV registers so they can never disagree.
 */
import type { Settings } from './settings';
import type { Mode, Task, LateStatus, LeaveKind, LeaveStatus, Target, WorkType } from './db/schema';
import { MODES, LKIND } from './constants';
import { addD, dim, dow, hm2m, keyOf, minsOf, addMonth, monthOf } from './time';

export type PersonLite = { id: number; type: WorkType };
export type LeaveLite = { id?: number; half: boolean; kind: LeaveKind; appliedAt: string; status: LeaveStatus; source: 'employee' | 'hr'; reason?: string };
export type DayRec = {
  date: string;
  mode?: Mode | null; intent?: Mode | null;
  checkInAt?: string | null; checkInSrc?: string | null; checkOutAt?: string | null; checkOutSrc?: string | null;
  meetingNote?: string | null; blocker?: { text: string; resolved?: boolean; at?: string } | null;
  lateMins?: number | null; lateStatus?: LateStatus | null; lateExcused?: boolean;
  plan?: Task[]; eod?: string | null; metrics?: Record<string, number>;
  spot?: 'yes' | 'no' | null; edit?: { status: string } | null;
  leave?: LeaveLite | null;
};
export type Days = Record<string, DayRec>;

export const isWorkday = (s: Settings, k: string) => (s.workdays || [1, 2, 3, 4, 5]).includes(dow(k)) && !holidaySet(s).has(k);
export const holidaySet = (s: Settings) => new Set((s.holidays || []).map((h) => String(h).slice(0, 10)));
export const holidayName = (s: Settings, k: string) => {
  const h = (s.holidays || []).find((x) => String(x).slice(0, 10) === k);
  return h ? String(h).slice(10).trim() || 'Holiday' : '';
};
export const gameSet = (s: Settings) => new Set((s.gamesdays || []).map((h) => String(h).slice(0, 10)));

/** R9: applied at least one day before = planned. HR-entered leave (approving an absence) counts as planned. */
export const leavePlanned = (lv: LeaveLite | null | undefined, k: string) => {
  if (!lv) return true;
  if (lv.source === 'hr') return true;
  return lv.appliedAt ? keyOf(lv.appliedAt) < k : false;
};
/** Pending and approved leave both count (pending reserves the balance until HR decides). */
export const liveLeave = (lv: LeaveLite | null | undefined) => (lv && (lv.status === 'approved' || lv.status === 'pending') ? lv : null);

/**
 * R2/R4: computed when a check-in is written and stored on the day, so a later change to the
 * grace period doesn't rewrite last month's late marks.
 */
export function computeLate(s: Settings, p: PersonLite, k: string, mode: Mode | null | undefined, checkInAt: string | null | undefined): { lateMins: number | null; lateStatus: LateStatus | null } {
  if (!checkInAt) return { lateMins: null, lateStatus: null };
  const m = minsOf(checkInAt) - hm2m(s.officeStart);
  if (p.type === 'part' || mode === 'meeting' || !isWorkday(s, k) || gameSet(s).has(k)) return { lateMins: Math.max(0, m), lateStatus: 'exempt' };
  if ((mode === 'wfh' || mode === 'remote') && !s.lateAppliesToWfh) return { lateMins: Math.max(0, m), lateStatus: 'exempt' };
  if (m <= +s.graceMin) return { lateMins: Math.max(0, m), lateStatus: 'none' };
  return { lateMins: m, lateStatus: m > +s.severeLateMin ? 'severe' : 'late' };
}

export function lateInfo(s: Settings, p: PersonLite | null, rec: DayRec | null | undefined) {
  const z = { late: false, severe: false, mins: 0, excused: false };
  if (!rec || !rec.checkInAt || !p || p.type === 'part') return z;
  const lv = liveLeave(rec.leave);
  if (lv && lv.half) return z;
  const st = rec.lateStatus ?? computeLate(s, p, rec.date, rec.mode, rec.checkInAt).lateStatus;
  const mins = rec.lateMins ?? Math.max(0, minsOf(rec.checkInAt) - hm2m(s.officeStart));
  if (st !== 'late' && st !== 'severe') return { ...z, mins: Math.max(0, mins) };
  if (rec.lateExcused) return { ...z, mins, excused: true };
  return { late: true, severe: st === 'severe', mins, excused: false };
}

export type DayInfo = ReturnType<typeof dayInfo>;

export function dayInfo(s: Settings, p: PersonLite | null, k: string, rec: DayRec | null | undefined, today: string) {
  const i = {
    label: '', mcls: '', cls: '', leave: 0, half: false, unplanned: false, leavePending: false, leaveKind: 'casual' as LeaveKind,
    absent: 0, late: false, severe: false, lateMins: 0, excusedLate: false, mode: null as Mode | null,
    office: false, wfh: false, remote: false, meeting: false, hours: 0, ot: 0, worked: false, eodMissing: false,
    tasks: [0, 0] as [number, number], planned: false, manual: false, edited: false,
  };
  if (rec?.plan) i.tasks = [rec.plan.filter((x) => x.status === 'done').length, rec.plan.length];
  const wd = isWorkday(s, k), lv = liveLeave(rec?.leave), gd = gameSet(s).has(k);
  if (lv) {
    i.leave = lv.half ? 0.5 : 1; i.half = lv.half; i.unplanned = !leavePlanned(lv, k);
    i.leaveKind = LKIND[lv.kind] ? lv.kind : 'casual'; i.leavePending = lv.status === 'pending';
  }
  if (rec?.checkInAt) {
    i.worked = true;
    i.mode = rec.mode && MODES[rec.mode] ? rec.mode : 'office';
    i.office = i.mode === 'office'; i.wfh = i.mode === 'wfh'; i.remote = i.mode === 'remote'; i.meeting = i.mode === 'meeting';
    const li = lateInfo(s, p, rec);
    i.late = li.late && !li.severe; i.severe = li.severe; i.lateMins = li.mins; i.excusedLate = li.excused;
    if (rec.checkOutAt) i.hours = Math.max(0, (Date.parse(rec.checkOutAt) - Date.parse(rec.checkInAt)) / 36e5);
    i.ot = Math.max(0, i.hours - (+s.dailyMaxHours || 9));
    if (k < today && !gd && !(rec.eod && rec.eod.trim())) i.eodMissing = true;
    i.label = MODES[i.mode].label; i.mcls = 'm-' + i.mode; i.cls = i.severe ? 'bad' : i.late ? 'warn' : MODES[i.mode].cls;
    if (gd) { i.label = 'Gamesday'; i.mcls = 'm-game'; }
  }
  if (lv && !lv.half) {
    i.label = i.unplanned ? 'Unplanned leave' : 'Leave'; i.mcls = 'm-leave'; i.cls = i.unplanned ? 'bad' : 'info';
  } else if (!rec?.checkInAt) {
    if (holidaySet(s).has(k)) { i.label = 'Holiday'; i.mcls = 'm-hol'; i.cls = 'mute'; }
    else if (!wd) { i.mcls = 'm-off'; i.cls = 'mute'; }
    else if (k > today && rec?.intent && MODES[rec.intent]) { i.label = MODES[rec.intent].label + ' · plan'; i.mcls = 'm-' + rec.intent + ' plan'; i.planned = true; }
    else if (k < s.goLive || k > today) { if (gd) { i.label = 'Gamesday'; i.mcls = 'm-game'; } }
    else if (k === today) { i.label = gd ? 'Gamesday' : 'Not in yet'; i.mcls = gd ? 'm-game' : 'm-pending'; i.cls = 'mute'; }
    else if (gd) { i.label = 'Gamesday'; i.mcls = 'm-game'; }
    else if (p && p.type !== 'part') { i.label = 'Absent'; i.mcls = 'm-absent'; i.cls = 'bad'; i.absent = lv ? 0.5 : 1; }
  }
  // Spot check: an office check-in when the person wasn't there counts as absent.
  if (rec?.spot === 'no') {
    i.label = 'Not in office'; i.mcls = 'm-absent'; i.cls = 'bad'; i.absent = 1; i.office = false; i.late = false; i.severe = false; i.hours = 0; i.ot = 0;
  }
  i.manual = !!(rec?.checkInAt && rec.checkInSrc === 'manual');
  i.edited = !!(rec?.edit && rec.edit.status === 'pending');
  if (i.half) {
    i.label = 'Half day' + (i.label && i.mcls !== 'm-pending' ? ' · ' + i.label : '');
    if (!i.mcls || i.mcls === 'm-pending' || i.mcls === 'm-off') i.mcls = 'm-half';
    if (!i.cls || i.cls === 'mute') i.cls = i.unplanned ? 'bad' : 'info';
  }
  return i;
}

export type MonthSummary = ReturnType<typeof monthSummary>;

export function monthSummary(s: Settings, p: PersonLite | null, days: Days, ym: string, today: string) {
  const n = dim(ym);
  const r = {
    lateMarks: 0, severe: 0, eodMissing: 0, leave: 0, unplanned: 0, absent: 0, office: 0, wfh: 0, remote: 0, meeting: 0,
    hours: 0, hoursDays: 0, tDone: 0, tAll: 0, worked: 0, eodDone: 0, metrics: {} as Record<string, number>,
    cells: [] as { k: string; i: DayInfo; rec?: DayRec }[], lvCL: 0, lvEL: 0, lvLWP: 0, otHours: 0, otDays: 0,
    eodMarks: 0, totalMarks: 0, halfDays: 0, used: 0,
  };
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`, rec = days[k], i = dayInfo(s, p, k, rec, today);
    r.cells.push({ k, i, rec });
    if (rec?.metrics) for (const m in rec.metrics) r.metrics[m] = (r.metrics[m] || 0) + (+rec.metrics[m] || 0);
    r.tDone += i.tasks[0]; r.tAll += i.tasks[1];
    if (k < s.goLive || k > today) continue; // R13: practice period / future
    if (i.late) r.lateMarks++;
    if (i.severe) r.severe++;
    if (i.eodMissing) r.eodMissing++;
    r.leave += i.leave;
    if (i.leave && i.unplanned) r.unplanned += i.leave;
    r.absent += i.absent;
    if (i.leave) { if (i.leaveKind === 'earned') r.lvEL += i.leave; else if (i.leaveKind === 'lwp') r.lvLWP += i.leave; else r.lvCL += i.leave; }
    if (i.ot > 0.01) { r.otHours += i.ot; r.otDays++; }
    if (i.office) r.office++;
    if (i.wfh) r.wfh++;
    if (i.remote) r.remote++;
    if (i.meeting) r.meeting++;
    if (i.worked) { r.worked++; if (rec?.eod && rec.eod.trim()) r.eodDone++; }
    if (i.hours) { r.hours += i.hours; r.hoursDays++; }
  }
  if (p?.type === 'part') { r.lateMarks = 0; r.severe = 0; r.eodMissing = 0; }
  r.eodMarks = Math.floor(r.eodMissing / 3); // R5
  r.totalMarks = r.lateMarks + r.eodMarks;
  r.halfDays = Math.floor(r.totalMarks / Math.max(1, +s.latesPerHalfDay)) + r.severe; // R3 + R4
  r.used = r.leave + r.absent + r.halfDays * 0.5;
  return r;
}

export type YearSummary = ReturnType<typeof yearSummary>;

/** R8/R15: leave-year balances. Cuts and absences consume casual, then earned, then LWP. */
export function yearSummary(s: Settings, p: PersonLite | null, days: Days, today: string, openingEL = 0) {
  const cm = monthOf(today), y = +today.slice(0, 4), m = +today.slice(5, 7), sm = +s.leaveYearStartMonth || 4;
  let ym = `${m >= sm ? y : y - 1}-${String(sm).padStart(2, '0')}`;
  let cl = 0, el = 0, lwpL = 0, charge = 0, used = 0;
  while (ym <= cm) {
    const ms = monthSummary(s, p, days, ym, today);
    cl += ms.lvCL; el += ms.lvEL; lwpL += ms.lvLWP; charge += ms.absent + ms.halfDays * 0.5; used += ms.used;
    ym = addMonth(ym, 1);
  }
  const clEnt = +s.casualLeave || 0, elEnt = (+s.earnedLeave || 0) + (+openingEL || 0);
  let clU = cl, elU = el, lwp = lwpL, rem = charge;
  const c1 = Math.min(rem, Math.max(0, clEnt - clU)); clU += c1; rem -= c1;
  const c2 = Math.min(rem, Math.max(0, elEnt - elU)); elU += c2; rem -= c2;
  lwp += rem;
  lwp += Math.max(0, clU - clEnt) + Math.max(0, elU - elEnt);
  const clB = Math.max(0, clEnt - clU), elB = Math.max(0, elEnt - elU);
  return { used, charge, cl: { ent: clEnt, used: Math.min(clU, clEnt), bal: clB }, el: { ent: elEnt, used: Math.min(elU, elEnt), bal: elB }, lwp, balance: clB + elB };
}

export function weekSummary(s: Settings, p: PersonLite | null, days: Days, mon: string, today: string) {
  const w = { office: 0, wfh: 0, hours: 0, metrics: {} as Record<string, number>, days: [] as { k: string; i: DayInfo; rec?: DayRec }[] };
  for (let j = 0; j < 7; j++) {
    const k = addD(mon, j), rec = days[k], i = dayInfo(s, p, k, rec, today);
    w.days.push({ k, i, rec });
    // R10: Meeting/Event and Gamesday count as office days.
    if (i.office || i.meeting || (i.worked && gameSet(s).has(k))) w.office++;
    else if (i.wfh || i.remote) w.wfh++;
    w.hours += i.hours;
    if (rec?.metrics) for (const m in rec.metrics) w.metrics[m] = (w.metrics[m] || 0) + (+rec.metrics[m] || 0);
  }
  return w;
}

export const tDone = (x: Target, wk: { metrics: Record<string, number> }) => (x.metric ? wk.metrics[x.metric] || 0 : +x.done || 0);
export function tPct(tg: Target[] | undefined, wk: { metrics: Record<string, number> }) {
  if (!tg || !tg.length) return null;
  return Math.round((100 * tg.reduce((a, x) => a + Math.min(1, tDone(x, wk) / Math.max(1, +x.goal || 1)), 0)) / tg.length);
}

/** Months of the current leave year up to today, for loading data. */
export const leaveYearStart = (s: Settings, today: string) => {
  const y = +today.slice(0, 4), m = +today.slice(5, 7), sm = +s.leaveYearStartMonth || 4;
  return `${m >= sm ? y : y - 1}-${String(sm).padStart(2, '0')}-01`;
};
