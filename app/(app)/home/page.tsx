import { requireUser } from '@/lib/auth';
import { dbNow, getSettings, getHr, loadDays, getWeeks } from '@/lib/data';
import { carryCandidates } from '@/lib/day';
import { monthSummary, yearSummary, weekSummary, tPct, tDone, gameSet, holidaySet, isWorkday, leaveYearStart, liveLeave } from '@/lib/rules';
import { keyOf, monday, monthOf, addD, minsOf } from '@/lib/time';
import { shortName } from '@/lib/names';
import { profilePct } from '@/lib/profile';
import { HomeClient } from './HomeClient';

export default async function HomePage() {
  const me = await requireUser();
  const [now, s, hr] = await Promise.all([dbNow(), getSettings(), getHr(me.id)]);
  const today = keyOf(now);
  const mon = monday(today);
  const p = { id: me.id, type: me.type };
  const [daysMap, weeks, carry] = await Promise.all([
    loadDays([me.id], leaveYearStart(s, today) < addD(mon, -40) ? leaveYearStart(s, today) : addD(mon, -40), addD(today, 120)),
    getWeeks([me.id], mon),
    carryCandidates(me.id, today),
  ]);
  const days = daysMap.get(me.id)!;
  const rec = days[today] || null;
  const ms = monthSummary(s, p, days, monthOf(today), today);
  const yr = yearSummary(s, p, days, today, +(hr?.job?.openingEL || 0));
  const wk = weekSummary(s, p, days, mon, today);
  const week = weeks.get(me.id);
  const targets = week?.targets || [];

  const coming: { k: string; name: string; sub: string }[] = [];
  (s.holidays || []).forEach((h) => { const k = String(h).slice(0, 10); if (k >= today) coming.push({ k, name: String(h).slice(10).trim() || 'Holiday', sub: 'Holiday' }); });
  (s.gamesdays || []).forEach((h) => { const k = String(h).slice(0, 10); if (k >= today) coming.push({ k, name: 'Gamesday', sub: 'Team event' }); });
  Object.values(days).forEach((d) => { const lv = liveLeave(d.leave); if (lv && d.date > today) coming.push({ k: d.date, name: 'Your leave', sub: (lv.half ? 'Half day' : 'Full day') + (lv.status === 'pending' ? ' · awaiting HR' : '') }); });
  coming.sort((a, b) => (a.k < b.k ? -1 : 1));

  const tag = [gameSet(s).has(today) ? 'Gamesday' : '', holidaySet(s).has(today) ? 'Holiday' : '', !isWorkday(s, today) && !holidaySet(s).has(today) ? 'Not a working day' : ''].filter(Boolean).join(' · ');
  const lv = liveLeave(rec?.leave);

  return (
    <HomeClient
      d={{
        first: shortName(me.fullName), empNo: me.empNo, role: me.role, type: me.type, metrics: me.metrics,
        s, today, serverNow: now.getTime(), nowMins: minsOf(now), tag,
        rec: rec ? {
          mode: rec.mode ?? null, intent: rec.intent ?? null, checkInAt: rec.checkInAt ?? null, checkOutAt: rec.checkOutAt ?? null,
          meetingNote: rec.meetingNote ?? null, plan: rec.plan || [], eod: rec.eod ?? null,
          metrics: rec.metrics || {}, blocker: rec.blocker ?? null,
          spot: rec.spot ?? null, lateStatus: rec.lateStatus ?? null, lateMins: rec.lateMins ?? null, lateExcused: !!rec.lateExcused,
        } : null,
        leave: lv ? { half: lv.half, status: lv.status, planned: lv.source === 'hr' || keyOf(lv.appliedAt) < today } : null,
        carry: { from: carry.from, count: carry.items.length },
        goals: {
          pct: tPct(targets, wk), comment: week?.seniorComment || '',
          items: targets.slice(0, 4).map((x) => ({ text: x.text, done: tDone(x, wk), goal: Math.max(1, +x.goal || 1) })),
        },
        glance: {
          totalMarks: ms.totalMarks, halfDays: ms.halfDays, balance: yr.balance, cl: yr.cl.bal, el: yr.el.bal, lwp: yr.lwp,
          office: wk.office, worked: wk.office + wk.wfh, hours: wk.hours,
        },
        coming: coming.slice(0, 4),
        profilePct: profilePct(hr?.personal, !!me.photo, me.fullName).pct,
      }}
    />
  );
}
