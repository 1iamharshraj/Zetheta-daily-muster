import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getPeople, getHr, getWeeks } from '@/lib/data';
import { monthSummary, yearSummary, weekSummary, leaveYearStart, tPct, tDone, leavePlanned } from '@/lib/rules';
import { addD, addMonth, fmtMonth, monday, monthOf, num } from '@/lib/time';
import { shortName } from '@/lib/names';
import { SENIOR } from '@/lib/constants';
import { Topbar } from '@/components/Shell';
import { Avatar, Bar, Chip } from '@/components/ui';
import { AttendanceView } from '@/components/AttendanceView';
import { DayDetail } from './DayDetail';

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const p = (await getPeople()).find((x) => x.id === +id && x.status !== 'pending');
  if (!p) notFound();
  const [today, s] = await Promise.all([getToday(), getSettings()]);
  const sp = await searchParams;
  const cur = monthOf(today);
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= cur ? sp.m : cur;
  const hr = me.sessionRole === 'hr';
  const from = [leaveYearStart(s, today), ym + '-01', addD(monday(today), -1)].sort()[0];
  const [daysMap, hrRec, weeks] = await Promise.all([loadDays([p.id], from, addD(today, 120)), getHr(p.id), getWeeks([p.id], monday(today))]);
  const days = daysMap.get(p.id)!;
  const ms = monthSummary(s, p, days, ym, today);
  const yr = yearSummary(s, p, days, today, +(hrRec?.job?.openingEL || 0));
  const wk = weekSummary(s, p, days, monday(today), today);
  const week = weeks.get(p.id);
  const name = shortName(p.fullName);
  const list = ms.cells.slice().reverse().filter((c) => c.k <= today && (c.rec || c.i.absent)).map((c) => ({
    k: c.k, i: c.i, rec: c.rec ?? null,
    planned: c.rec?.leave ? leavePlanned(c.rec.leave, c.k) : true,
  }));
  return (
    <>
      <Topbar title="Team member" />
      <main id="app" className="anim">
        <div className="toolbar">
          <div>
            <Link className="link back" href="/team">← Back to overview</Link>
            <div className="row gap"><Avatar name={name} photo={p.photo} size="lg" /><h2>{name}</h2><Chip>{p.empNo}</Chip></div>
            <span className="role">{p.role}{p.type === 'part' ? ' · part-time' : p.type === 'remote' ? ' · remote' : ''}</span>
          </div>
          <div className="row gap">
            <Link className="btn sm" href={`/team/${p.id}?m=${addMonth(ym, -1)}`}>← {fmtMonth(addMonth(ym, -1))}</Link>
            {ym >= cur ? <button className="btn sm" disabled>{fmtMonth(addMonth(ym, 1))} →</button> : <Link className="btn sm" href={`/team/${p.id}?m=${addMonth(ym, 1)}`}>{fmtMonth(addMonth(ym, 1))} →</Link>}
          </div>
        </div>
        {!p.hasAccount && <div className="banner">Not signed in yet. They need to open the muster once and create their password.</div>}
        {p.status === 'left' && <div className="banner">Left the company.</div>}
        <section className="card"><div className="sec-h"><h3>{fmtMonth(ym)}</h3></div>
          <dl className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
            <div className={ms.totalMarks ? 'warnv' : ''}><dt>Late marks</dt><dd>{ms.totalMarks}</dd><small>{ms.lateMarks} late + {ms.eodMarks} from summaries</small></div>
            <div className={ms.halfDays ? 'badv' : ''}><dt>Half-day cuts</dt><dd>{ms.halfDays}</dd><small>{ms.severe} for {s.severeLateMin}+ min late</small></div>
            <div><dt>Leave taken</dt><dd>{num(ms.leave)}</dd><small>{num(ms.unplanned)} unplanned</small></div>
            <div className={ms.absent ? 'badv' : ''}><dt>Absent</dt><dd>{num(ms.absent)}</dd><small>no check-in, no leave</small></div>
            <div><dt>Office · WFH · Remote · Event</dt><dd>{ms.office} · {ms.wfh} · {ms.remote} · {ms.meeting}</dd></div>
            <div><dt>Avg hours</dt><dd>{ms.hoursDays ? (ms.hours / ms.hoursDays).toFixed(1) : '—'}</dd></div>
            <div><dt>Tasks done</dt><dd>{ms.tAll ? Math.round((100 * ms.tDone) / ms.tAll) + '%' : '—'}</dd><small>{ms.tDone} of {ms.tAll}</small></div>
            <div className={yr.lwp ? 'badv' : ''}><dt>Leave balance</dt><dd>{num(yr.balance)}</dd><small>{num(yr.cl.bal)} CL · {num(yr.el.bal)} EL{yr.lwp ? ' · ' + num(yr.lwp) + ' LWP' : ''}</small></div>
            <div className={ms.otDays ? 'warnv' : ''}><dt>Overtime</dt><dd>{ms.otHours.toFixed(1)} h</dd><small>{ms.otDays} day(s) over {s.dailyMaxHours} h</small></div>
          </dl>
        </section>
        <div className="two">
          <div className="col"><AttendanceView ym={ym} today={today} ms={ms} s={s} type={p.type} basePath={`/team/${p.id}`} hideLog hideStrip /></div>
          <section className="card">
            <div className="sec-h"><h3>This week’s goals</h3>{week?.seniorStatus && <Chip c={SENIOR[week.seniorStatus].c}>{SENIOR[week.seniorStatus].l}</Chip>}</div>
            {week?.targets?.length ? (<>
              <div className="pctrow"><span className="pct">{tPct(week.targets, wk)}%</span><span className="muted">achieved so far</span></div>
              {week.targets.map((x) => { const g = Math.max(1, +x.goal || 1), dn = tDone(x, wk); return <div key={x.id}><div className="kv"><span>{x.text}</span><span>{dn}/{g}</span></div><Bar v={Math.min(dn, g)} max={g} /></div>; })}
            </>) : <p className="note">No targets set this week.</p>}
            {week?.selfReview && <div className="quote"><b>Self-review:</b> {week.selfReview}</div>}
            {week?.seniorComment && <div className="quote"><b>Senior:</b> {week.seniorComment}</div>}
            <Link className="link" href="/reviews">All weekly reviews →</Link>
          </section>
        </div>
        <section className="card"><div className="sec-h"><h3>Day by day</h3></div>
          {list.length ? list.map((x) => <DayDetail key={x.k} personId={p.id} type={p.type} k={x.k} i={x.i} rec={x.rec} planned={x.planned} hr={hr} />) : <p className="note">Nothing recorded this month yet.</p>}
        </section>
      </main>
    </>
  );
}

