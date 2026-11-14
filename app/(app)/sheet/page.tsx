import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getPeople } from '@/lib/data';
import { monthSummary } from '@/lib/rules';
import { addMonth, dim, dow, fmtMonth, fmtShort, hmOf, kd, monthOf, num } from '@/lib/time';
import { METRICS } from '@/lib/constants';
import { shortName } from '@/lib/names';
import { Topbar, AutoRefresh } from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { CopyButton } from '@/components/CopyButton';

export default async function SheetPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await requireUser();
  const [today, s, all] = await Promise.all([getToday(), getSettings(), getPeople()]);
  const sp = await searchParams;
  const cur = monthOf(today);
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= cur ? sp.m : cur;
  const n = dim(ym);
  // Everyone active, plus people who left during or after this month.
  const ppl = all.filter((p) => p.status === 'active');
  const daysMap = await loadDays(ppl.map((p) => p.id), ym + '-01', `${ym}-${n}`);
  const data = ppl.map((p) => ({ p, name: shortName(p.fullName), days: daysMap.get(p.id)!, ms: monthSummary(s, p, daysMap.get(p.id)!, ym, today) }));
  const wds = s.workdays || [1, 2, 3, 4, 5];
  const hr = me.sessionRole === 'hr';

  const tsv = [['Day', 'Date', ...data.map((x) => x.name)].join('\t')];
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`;
    tsv.push([kd(k).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long' }), `${String(d).padStart(2, '0')}/${k.slice(5, 7)}/${k.slice(0, 4)}`,
      ...data.map((x) => { const i = x.ms.cells[d - 1].i, r = x.days[k]; return (i.label || '') + (r?.checkInAt ? ' ' + hmOf(r.checkInAt) : '') + (i.late || i.severe ? ` (+${i.lateMins}m)` : ''); })].join('\t'));
  }

  const foot: [string, (x: (typeof data)[number]) => string | number, string?][] = [
    ['Office', (x) => x.ms.office], ['Meeting / Event', (x) => x.ms.meeting], ['WFH', (x) => x.ms.wfh], ['Remote', (x) => x.ms.remote],
    ['Late marks', (x) => x.ms.totalMarks, 'warn'], ['Half-day cuts', (x) => x.ms.halfDays, 'bad'], ['Leave', (x) => num(x.ms.leave)],
    ['Unplanned leave', (x) => num(x.ms.unplanned), 'bad'], ['Absent', (x) => num(x.ms.absent), 'bad'],
    ['Avg hours', (x) => (x.ms.hoursDays ? (x.ms.hours / x.ms.hoursDays).toFixed(1) : '—')],
    ['Overtime hours', (x) => x.ms.otHours.toFixed(1), 'warn'],
    ['Tasks done', (x) => (x.ms.tAll ? Math.round((100 * x.ms.tDone) / x.ms.tAll) + '%' : '—')],
    ['Summaries in', (x) => (x.ms.worked ? Math.round((100 * x.ms.eodDone) / x.ms.worked) + '%' : '—')],
  ];
  const used = new Set<string>();
  data.forEach((x) => x.p.metrics.forEach((m) => used.add(m)));
  const mk = Object.keys(METRICS).filter((m) => used.has(m));

  return (
    <>
      <Topbar title="Attendance sheet">
        {hr && <a className="btn sm" href={`/api/registers/muster?m=${ym}`}><Icon n="dl" /> Download muster roll</a>}
        <CopyButton text={tsv.join('\n')} label="Copy to Google Sheets" done="Copied. Paste into Google Sheets with Ctrl+V." />
      </Topbar>
      <AutoRefresh seconds={60} />
      <main id="app" className="anim">
        <div className="toolbar"><h2>Muster roll · {fmtMonth(ym)}</h2>
          <div className="row gap">
            <Link className="btn sm" href={`/sheet?m=${addMonth(ym, -1)}`}>← Previous</Link>
            <Link className="btn sm" href="/sheet">This month</Link>
            {ym >= cur ? <button className="btn sm" disabled>Next →</button> : <Link className="btn sm" href={`/sheet?m=${addMonth(ym, 1)}`}>Next →</Link>}
          </div>
        </div>
        <p className="hint">Dates down the side, people across. Each cell fills itself when the person checks in. Tap a name for their day-by-day detail.</p>
        <div className="legend">
          {[['m-office', 'Office'], ['m-wfh', 'WFH'], ['m-remote', 'Remote'], ['m-meeting', 'Meeting / Event'], ['m-half', 'Half day'], ['m-leave', 'Leave'], ['m-absent', 'Absent'], ['m-hol', 'Holiday'], ['m-game', 'Gamesday']].map(([c, l]) => <span key={c} className={'lg ' + c}>{l}</span>)}
          <span>Times are check-ins. <b className="c-bad">+27m</b> = late mark, <b className="c-bad">½ day</b> = {s.severeLateMin}+ min late.</span>
        </div>
        <div className="tbl reg"><table>
          <thead><tr><th className="nm">Date</th>{data.map(({ p, name }) => (
            <th key={p.id} className="pp"><Link className="pname" style={{ fontSize: '.86rem' }} href={`/team/${p.id}`}>{name}</Link>
              <small>{!p.hasAccount ? 'not signed in' : p.type === 'remote' ? 'remote' : p.type === 'part' ? 'part-time' : 'hybrid'}</small></th>
          ))}</tr></thead>
          <tbody>{Array.from({ length: n }, (_, j) => {
            const d = j + 1, k = `${ym}-${String(d).padStart(2, '0')}`, we = !wds.includes(dow(k));
            return (
              <tr key={k} className={we ? 'we' : ''}>
                <td className="nm">{kd(k).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })} {String(d).padStart(2, '0')}/{k.slice(5, 7)}</td>
                {data.map((x) => {
                  const i = x.ms.cells[j].i, rec = x.days[k], lt = i.late || i.severe;
                  return (
                    <td key={x.p.id} className={`cell ${i.mcls}${lt ? ' late' : ''}`} title={`${x.name} · ${fmtShort(k)}${i.edited ? ' · edited by employee' : ''}${i.leavePending ? ' · leave awaiting HR' : ''}`}>
                      <Link href={`/team/${x.p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        {i.label}{(i.edited || i.manual) && ' ✎'}
                        {lt ? <span className="lt">{i.severe ? '½ day · ' : ''}+{i.lateMins}m</span>
                          : i.worked && rec?.checkInAt ? <span className="tm">{hmOf(rec.checkInAt)}{i.excusedLate ? ' · excused' : ''}</span> : null}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}</tbody>
          <tfoot>{foot.map(([l, f, c]) => (
            <tr key={l}><td className="nm">{l}</td>{data.map((x) => { const v = f(x); return <td key={x.p.id} className={c && v && v !== '0' && v !== '0.0' ? c : ''}>{v}</td>; })}</tr>
          ))}</tfoot>
        </table></div>
        {mk.length > 0 && (
          <section className="card"><div className="sec-h"><h3>Outreach &amp; output · {fmtMonth(ym)}</h3><span className="count">from daily numbers</span></div>
            <div className="tbl" style={{ border: 0 }}><table>
              <thead><tr><th className="nm">Name</th>{mk.map((m) => <th key={m}>{METRICS[m]}</th>)}</tr></thead>
              <tbody>
                {data.filter((x) => x.p.metrics.length).map((x) => (
                  <tr key={x.p.id}><td className="nm">{x.name}</td>{mk.map((m) => <td key={m} className="sum">{x.p.metrics.includes(m) ? x.ms.metrics[m] || 0 : <span className="muted">·</span>}</td>)}</tr>
                ))}
                <tr><td className="nm"><b>Team total</b></td>{mk.map((m) => <td key={m} className="sum">{data.reduce((a, x) => a + (x.ms.metrics[m] || 0), 0)}</td>)}</tr>
              </tbody>
            </table></div>
          </section>
        )}
      </main>
    </>
  );
}
