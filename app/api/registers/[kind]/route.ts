import { NextResponse, type NextRequest } from 'next/server';
import { getMe } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getPeople, getAllHr, audit } from '@/lib/data';
import { dayInfo, monthSummary, yearSummary, leaveYearStart, type DayInfo } from '@/lib/rules';
import { dim, dmy, hmOf, monthOf, fmtMonth } from '@/lib/time';
import { profilePct } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const csv = (rows: (string | number | null | undefined)[][]) =>
  '﻿' + rows.map((r) => r.map((c) => { const s = c == null ? '' : String(c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');

function codeOf(i: DayInfo) {
  if (i.mcls === 'm-hol' && !i.worked) return 'H';
  if (i.mcls === 'm-off' && !i.worked) return 'WO';
  if (i.absent) return 'A';
  const lk = ({ casual: 'CL', earned: 'EL', lwp: 'LWP' } as const)[i.leaveKind] || '';
  if (i.leave === 1) return lk;
  let c = i.office ? 'P' : i.wfh ? 'WFH' : i.remote ? 'R' : i.meeting ? 'E' : '';
  if (i.half) c = 'HD-' + lk + (c ? '/' + c : '');
  if (i.late || i.severe) c += '*';
  return c;
}
const ec = (n?: unknown, r?: unknown, ph?: unknown) => [n, r ? `(${r})` : '', ph].filter(Boolean).join(' ');

/** §8.4 statutory registers as CSV. HR only. ?m=YYYY-MM for monthly registers. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const me = await getMe();
  if (!me || !me.mfaOk || me.status !== 'active' || me.sessionRole !== 'hr') return NextResponse.json({ error: 'HR only' }, { status: 403 });
  const { kind } = await ctx.params;
  const [today, s, all, hr] = await Promise.all([getToday(), getSettings(), getPeople(), getAllHr()]);
  const qm = req.nextUrl.searchParams.get('m');
  const ym = qm && /^\d{4}-\d{2}$/.test(qm) ? qm : monthOf(today);
  const n = dim(ym), from = ym + '-01', to = `${ym}-${n}`;
  const ppl = all.filter((p) => p.status !== 'pending');
  // Monthly registers include anyone active, or who left during/after the month.
  const inMonth = ppl.filter((p) => p.status === 'active' || (hr.get(p.id)?.job?.exitDate || '9999') >= from);
  let name = '', rows: (string | number | null | undefined)[][] = [];

  if (kind === 'employees') {
    name = `Zetheta_Register_of_Employees_${dmy(today)}.csv`;
    rows = [['Employee No', 'Name', 'Gender', 'Date of birth', 'Designation', 'Department', 'Employment type', 'Date of joining', 'Probation ends', 'Fixed-term ends', 'Monthly wages (Rs)', 'Mode of payment', 'UAN', 'ESIC IP No', 'Mobile (WhatsApp)', 'Primary email', 'Secondary email', 'Permanent address', 'Permanent PIN', 'Present address', 'Present PIN', 'Emergency contact 1', 'Emergency contact 2', 'Appointment letter date', 'Date of leaving', 'Reason for leaving', 'Status', 'Profile complete']];
    for (const p of ppl) {
      const pe = hr.get(p.id)?.personal || {}, j = hr.get(p.id)?.job || {};
      rows.push([p.empNo, p.fullName, pe.gender as string, dmy(pe.dob as string), j.designation || p.role, j.department, j.category, dmy(j.doj), dmy(j.probationEnd), dmy(j.fixedTermEnd), j.wageMonthly, j.payMode, j.uan, j.esicIp,
        pe.mobile as string, (pe.primaryEmail as string) || p.email, pe.secondaryEmail as string, pe.permAddr as string, pe.permPin as string, pe.presentAddr as string, pe.presentPin as string,
        ec(pe.emName, pe.emRel, pe.emPhone), ec(pe.em2Name, pe.em2Rel, pe.em2Phone), dmy(j.apptLetterDate), dmy(j.exitDate), j.exitReason,
        p.status === 'left' ? 'Left' : 'Active', profilePct(pe, !!p.photo, p.fullName).pct + '%']);
    }
  } else if (['muster', 'attendance', 'overtime'].includes(kind)) {
    const days = await loadDays(inMonth.map((p) => p.id), from, to);
    if (kind === 'muster') {
      name = `Zetheta_Muster_Roll_${ym}.csv`;
      rows = [['Employee No', 'Name', ...Array.from({ length: n }, (_, d) => String(d + 1)), 'Office/WFH/Remote/Event days', 'Leave days', 'Absent', 'Late marks', 'Half-day cuts', 'Overtime hours']];
      for (const p of inMonth) {
        const ms = monthSummary(s, p, days.get(p.id)!, ym, today);
        rows.push([p.empNo, p.fullName, ...ms.cells.map((c) => (c.k > today ? '' : codeOf(c.i))), ms.office + ms.wfh + ms.remote + ms.meeting, ms.leave, ms.absent, ms.totalMarks, ms.halfDays, ms.otHours.toFixed(2)]);
      }
      rows.push([], ['Codes: P office, WFH work from home, R remote, E meeting/event, CL casual leave, EL earned leave, LWP leave without pay, HD half day, A absent, H holiday, WO weekly off, * late']);
    } else if (kind === 'attendance') {
      name = `Zetheta_Attendance_Register_${ym}.csv`;
      rows = [['Date', 'Employee No', 'Name', 'Status', 'In', 'Out', 'Hours', 'Overtime hours', 'Late by (min)', 'Entry', 'Remarks']];
      for (let d = 1; d <= n; d++) {
        const k = `${ym}-${String(d).padStart(2, '0')}`;
        if (k > today) break;
        for (const p of inMonth) {
          const r = days.get(p.id)![k], i = dayInfo(s, p, k, r, today);
          if (!r && !i.absent) continue;
          rows.push([dmy(k), p.empNo, p.fullName, i.label + (i.leavePending ? ' (awaiting HR)' : ''), hmOf(r?.checkInAt), hmOf(r?.checkOutAt), i.hours ? i.hours.toFixed(2) : '', i.ot ? i.ot.toFixed(2) : '',
            i.late || i.severe ? i.lateMins : '', r?.checkInAt ? ({ server: 'Clock-in', manual: 'Entered by employee', hr: 'Corrected by HR' } as Record<string, string>)[r.checkInSrc || 'server'] : '',
            [r?.meetingNote, (r?.edit as { reason?: string } | null)?.reason, r?.leave?.reason, r?.spot === 'no' ? 'Spot check: not in office' : '', r?.lateExcused ? 'Late excused by HR' : ''].filter(Boolean).join('; ')]);
        }
      }
    } else {
      name = `Zetheta_Overtime_Register_${ym}.csv`;
      rows = [['Date', 'Employee No', 'Name', 'In', 'Out', 'Hours worked', 'Overtime hours', 'Overtime after (h/day)']];
      for (let d = 1; d <= n; d++) {
        const k = `${ym}-${String(d).padStart(2, '0')}`;
        for (const p of inMonth) {
          const r = days.get(p.id)![k];
          if (!r) continue;
          const i = dayInfo(s, p, k, r, today);
          if (i.ot > 0.01) rows.push([dmy(k), p.empNo, p.fullName, hmOf(r.checkInAt), hmOf(r.checkOutAt), i.hours.toFixed(2), i.ot.toFixed(2), s.dailyMaxHours]);
        }
      }
      if (rows.length === 1) rows.push([`No overtime recorded in ${fmtMonth(ym)}`]);
    }
  } else if (kind === 'leave') {
    const fromY = leaveYearStart(s, today);
    const days = await loadDays(inMonth.map((p) => p.id), fromY, today);
    name = `Zetheta_Leave_Register_${dmy(today)}.csv`;
    rows = [['Employee No', 'Name', 'Casual leave entitled', 'Casual availed', 'Casual balance', 'Earned leave entitled (incl. b/f)', 'Earned availed', 'Earned balance', 'Leave without pay', 'Leave year from']];
    for (const p of inMonth) {
      const yr = yearSummary(s, p, days.get(p.id)!, today, +(hr.get(p.id)?.job?.openingEL || 0));
      rows.push([p.empNo, p.fullName, yr.cl.ent, yr.cl.used, yr.cl.bal, yr.el.ent, yr.el.used, yr.el.bal, yr.lwp, dmy(fromY)]);
    }
  } else if (kind === 'payroll') {
    // v2 P2: month-end payroll summary.
    const fromY = [leaveYearStart(s, today), from].sort()[0];
    const days = await loadDays(inMonth.map((p) => p.id), fromY, to);
    name = `Zetheta_Payroll_Summary_${ym}.csv`;
    rows = [['Employee No', 'Name', 'Days in month', 'Days worked', 'Paid leave days', 'Absent', 'Half-day cuts', 'Leave without pay (leave year to date)', 'Overtime hours', 'Monthly wages (Rs)']];
    for (const p of inMonth) {
      const d = days.get(p.id)!, ms = monthSummary(s, p, d, ym, today), yr = yearSummary(s, p, d, to < today ? to : today, +(hr.get(p.id)?.job?.openingEL || 0));
      rows.push([p.empNo, p.fullName, n, ms.worked, ms.lvCL + ms.lvEL, ms.absent, ms.halfDays, yr.lwp, ms.otHours.toFixed(2), hr.get(p.id)?.job?.wageMonthly || '']);
    }
  } else {
    return NextResponse.json({ error: 'Unknown register' }, { status: 404 });
  }

  await audit(me.id, 'register.download', null, { kind, ym });
  return new NextResponse(csv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
}
