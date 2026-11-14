import Link from 'next/link';
import { requireHr } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getPeople, getAllHr, getLeaves } from '@/lib/data';
import { monthSummary, yearSummary, leaveYearStart, leavePlanned } from '@/lib/rules';
import { addD, monthOf, addMonth, num } from '@/lib/time';
import { LKIND } from '@/lib/constants';
import { shortName } from '@/lib/names';
import { profilePct } from '@/lib/profile';
import { Topbar } from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { HrDeskLists, type LeaveReq, type Absence, type EditRow } from './HrDeskLists';

export default async function HrDesk() {
  await requireHr();
  const [today, s, all, hrAll] = await Promise.all([getToday(), getSettings(), getPeople(), getAllHr()]);
  const ppl = all.filter((p) => p.status === 'active');
  const ids = ppl.map((p) => p.id);
  const from = [leaveYearStart(s, today), addD(today, -31)].sort()[0];
  const [daysMap, lvs] = await Promise.all([loadDays(ids, from, addD(today, 60)), getLeaves(ids, addD(today, -31), addD(today, 120))]);
  const byId = new Map(ppl.map((p) => [p.id, p]));
  const nm = (id: number) => shortName(byId.get(id)?.fullName || '');

  // Pending requests, grouped by person + application time so a multi-day request is one row.
  const pendingRaw = lvs.filter((l) => l.status === 'pending');
  const groups = new Map<string, typeof pendingRaw>();
  pendingRaw.forEach((l) => { const g = `${l.personId}|${l.appliedAt}|${l.kind}|${l.half}`; groups.set(g, [...(groups.get(g) || []), l]); });
  const requests: LeaveReq[] = [...groups.values()].map((ls) => ({
    ids: ls.map((l) => l.id), personId: ls[0].personId, name: nm(ls[0].personId), photo: byId.get(ls[0].personId)?.photo || null,
    from: ls[0].date, to: ls[ls.length - 1].date, n: ls.length, half: ls[0].half, kind: LKIND[ls[0].kind], reason: ls[0].reason,
    planned: leavePlanned(ls[0], ls[0].date),
  })).sort((a, b) => (a.from < b.from ? -1 : 1));

  const upcoming = lvs.filter((l) => l.status === 'approved' && l.date >= today && l.date <= addD(today, 60));
  const onLeave = lvs.filter((l) => l.date === today && !l.half && ['approved', 'pending'].includes(l.status)).length;

  const absences: Absence[] = [];
  const edits: EditRow[] = [];
  for (const p of ppl) {
    const days = daysMap.get(p.id)!;
    for (const ym of [addMonth(monthOf(today), -1), monthOf(today)]) {
      monthSummary(s, p, days, ym, today).cells.forEach((c) => {
        if (c.k < addD(today, -30) || c.k >= today) return;
        const lv = c.rec?.leave && ['approved', 'pending'].includes(c.rec.leave.status) ? c.rec.leave : null;
        if (c.i.absent && !lv) absences.push({ personId: p.id, name: shortName(p.fullName), photo: p.photo, k: c.k, kind: 'absent', label: c.rec?.spot === 'no' ? 'Not in office at spot check' : 'No check-in, no leave' });
        else if (lv && c.i.unplanned) absences.push({ personId: p.id, name: shortName(p.fullName), photo: p.photo, k: c.k, kind: 'unplanned', label: `${lv.half ? 'Half day' : 'Full day'} · ${LKIND[lv.kind]}${lv.reason ? ' · ' + lv.reason : ''}` });
      });
    }
    Object.values(days).forEach((d) => {
      const e = d.edit as { status: string; reason: string } | null | undefined;
      if (e?.status === 'pending') edits.push({ personId: p.id, name: shortName(p.fullName), photo: p.photo, k: d.date, reason: e.reason });
    });
  }
  absences.sort((a, b) => (a.k > b.k ? -1 : 1));
  edits.sort((a, b) => (a.k > b.k ? -1 : 1));

  const pend = all.filter((p) => p.status === 'pending').length;
  const noAppt = ppl.filter((p) => !hrAll.get(p.id)?.job?.apptLetterDate).length;
  const incomplete = ppl.filter((p) => profilePct(hrAll.get(p.id)?.personal, !!p.photo, p.fullName).pct < 100).length;
  const notIn = ppl.filter((p) => !p.hasAccount).length;
  const todo: [number, string, string][] = ([
    [pend, `new registration${pend === 1 ? '' : 's'} to confirm`, '/hr/settings#pending'],
    [requests.length, `leave request${requests.length === 1 ? '' : 's'} waiting for a decision`, '#requests'],
    [noAppt, `${noAppt === 1 ? 'employee' : 'employees'} without an appointment letter recorded`, '/hr/records'],
    [incomplete, `${incomplete === 1 ? 'employee' : 'employees'} with an incomplete profile`, '/hr/records'],
    [notIn, `${notIn === 1 ? 'employee' : 'employees'} not signed in yet`, '/hr/settings#accounts'],
  ] as [number, string, string][]).filter((x) => x[0]);

  return (
    <>
      <Topbar title="HR desk"><a className="btn primary sm" href="/api/registers/leave"><Icon n="dl" /> Leave register</a></Topbar>
      <main id="app" className="anim">
        <div className="strip">
          <div><b>{onLeave}</b><span>On leave today</span></div>
          <div><b>{upcoming.length}</b><span>Leave in the next 60 days</span></div>
          <div className={absences.length ? 'bad' : ''}><b>{absences.length}</b><span>Unplanned or absent, last 30 days</span></div>
          <div className={edits.length + requests.length ? 'warn' : ''}><b>{edits.length + requests.length}</b><span>Requests &amp; edits to review</span></div>
        </div>
        {todo.length > 0 && (
          <section className="card"><div className="sec-h"><h3>HR to-do</h3></div>
            <ul className="alist">{todo.map(([n, txt, h]) => (
              <li key={txt}><span className="adot warn" /><Link className="atext" href={h} style={{ textDecoration: 'none' }}><b>{n}</b> {txt}</Link><span className="go">→</span></li>
            ))}</ul>
          </section>
        )}
        <HrDeskLists requests={requests} absences={absences} edits={edits}
          upcoming={upcoming.map((l) => ({ id: l.id, personId: l.personId, name: nm(l.personId), photo: byId.get(l.personId)?.photo || null, k: l.date, half: l.half, kind: LKIND[l.kind], reason: l.reason, planned: leavePlanned(l, l.date) }))} />
        <section className="card"><div className="sec-h"><h3>Leave balances</h3><a className="btn sm" href="/api/registers/leave"><Icon n="dl" /> Leave register</a></div>
          <div className="tbl" style={{ border: 0 }}><table>
            <thead><tr><th className="nm">Employee</th><th>Casual left</th><th>Earned left</th><th>Without pay</th></tr></thead>
            <tbody>{ppl.map((p) => {
              const yr = yearSummary(s, p, daysMap.get(p.id)!, today, +(hrAll.get(p.id)?.job?.openingEL || 0));
              return (
                <tr key={p.id}><td className="nm"><Link href={`/team/${p.id}`}>{shortName(p.fullName)}</Link> <small className="muted">{p.empNo}</small></td>
                  <td>{num(yr.cl.bal)} / {num(yr.cl.ent)}</td><td>{num(yr.el.bal)} / {num(yr.el.ent)}</td><td className={yr.lwp ? 'sum bad' : ''}>{num(yr.lwp)}</td></tr>
              );
            })}</tbody>
          </table></div>
        </section>
      </main>
    </>
  );
}

