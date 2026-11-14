import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getHr, getLeaves } from '@/lib/data';
import { yearSummary, leaveYearStart, leavePlanned } from '@/lib/rules';
import { addD } from '@/lib/time';
import { Topbar } from '@/components/Shell';
import { ApplyLeaveButton } from '@/components/LeaveModal';
import { LeaveList } from './LeaveList';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default async function LeavePage() {
  const me = await requireUser();
  const [today, s, hr] = await Promise.all([getToday(), getSettings(), getHr(me.id)]);
  const from = leaveYearStart(s, today);
  const [days, all] = await Promise.all([loadDays([me.id], from, addD(today, 400)), getLeaves([me.id], addD(from, -1), addD(today, 400))]);
  const yr = yearSummary(s, { id: me.id, type: me.type }, days.get(me.id)!, today, +(hr?.job?.openingEL || 0));
  const rows = all.filter((l) => l.status !== 'cancelled').map((l) => ({
    id: l.id, date: l.date, half: l.half, kind: l.kind, reason: l.reason, status: l.status, hrComment: l.hrComment,
    planned: leavePlanned({ ...l }, l.date),
    cancellable: (l.status === 'pending' || l.status === 'approved') && l.date >= today,
  }));
  const up = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today).reverse();
  const live = up.filter((r) => r.status !== 'rejected').length;
  return (
    <>
      <Topbar title="Leave"><ApplyLeaveButton s={s} today={today} /></Topbar>
      <main id="app" className="anim">
        <div className="toolbar"><h2>Your leave</h2><ApplyLeaveButton s={s} today={today} cls="btn primary" /></div>
        <div className="strip">
          <div className="ok"><b>{yr.cl.bal}<small style={{ fontSize: '.9rem', color: 'var(--muted)' }}> / {yr.cl.ent}</small></b><span>Casual leave left</span></div>
          <div className="ok"><b>{yr.el.bal}<small style={{ fontSize: '.9rem', color: 'var(--muted)' }}> / {yr.el.ent}</small></b><span>Earned leave left</span></div>
          <div className={yr.lwp ? 'bad' : ''}><b>{yr.lwp}</b><span>Leave without pay</span></div>
          <div><b>{live}</b><span>Upcoming</span></div>
        </div>
        <p className="hint">Late-mark cuts and absences come out of casual leave first, then earned leave; anything beyond that is leave without pay. Requests awaiting HR already count against your balance.</p>
        {me.type === 'part' && <p className="note">Leave rules don’t apply to part-time work, but you can still mark days off here.</p>}
        <div className="two">
          <section className="card"><div className="sec-h"><h3>Upcoming</h3></div>
            {up.length ? <LeaveList rows={up} /> : (<><p className="hint">No leave planned. Apply at least a day ahead so it counts as planned.</p><ApplyLeaveButton s={s} today={today} cls="btn primary" /></>)}
          </section>
          <section className="card"><div className="sec-h"><h3>Past</h3></div>
            {past.length ? <LeaveList rows={past.slice(0, 40)} /> : <p className="hint">No leave taken yet.</p>}
          </section>
        </div>
        <p className="note">{s.casualLeave} casual + {s.earnedLeave} earned days a year, starting {MONTHS[(+s.leaveYearStartMonth || 4) - 1]}. <Link className="link" href="/rules">Full rules →</Link></p>
      </main>
    </>
  );
}
