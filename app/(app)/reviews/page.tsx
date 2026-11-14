import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, team, getWeeks } from '@/lib/data';
import { weekSummary, tPct, tDone } from '@/lib/rules';
import { addD, fmtShort, monday } from '@/lib/time';
import { shortName } from '@/lib/names';
import { SENIOR } from '@/lib/constants';
import { Topbar } from '@/components/Shell';
import { Bar, Chip } from '@/components/ui';
import { FeedbackBox } from './FeedbackBox';

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const me = await requireUser();
  const [today, s, ppl] = await Promise.all([getToday(), getSettings(), team()]);
  const sp = await searchParams;
  const tw = monday(today);
  const w = sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) && monday(sp.w) <= tw ? monday(sp.w) : tw;
  const ids = ppl.map((p) => p.id);
  const [daysMap, weeks] = await Promise.all([loadDays(ids, w, addD(w, 6)), getWeeks(ids, w)]);
  const hr = me.sessionRole === 'hr';
  return (
    <>
      <Topbar title="Weekly reviews" />
      <main id="app" className="anim">
        <div className="toolbar"><h2>Week of {fmtShort(w)}</h2>
          <div className="row gap">
            <Link className="btn sm" href={`/reviews?w=${addD(w, -7)}`}>← Previous</Link>
            <Link className="btn sm" href="/reviews">This week</Link>
            {w >= tw ? <button className="btn sm" disabled>Next →</button> : <Link className="btn sm" href={`/reviews?w=${addD(w, 7)}`}>Next →</Link>}
          </div>
        </div>
        <p className="hint">{hr ? 'Pick a status and write feedback for each person.' : 'Everyone’s weekly goals and progress.'} They see it on their Weekly goals page.</p>
        <div className="grid">{ppl.map((p) => {
          const doc = weeks.get(p.id), wk = weekSummary(s, p, daysMap.get(p.id)!, w, today), tg = doc?.targets || [], pct = tPct(tg, wk), name = shortName(p.fullName);
          return (
            <article key={p.id} className="card pc">
              <header className="pc-h"><Link className="pname" href={`/team/${p.id}`}>{name}</Link><span className="role">{p.role}</span></header>
              <div className="row between"><span className="pct">{pct == null ? '—' : pct + '%'}</span>
                <span className="count">{p.type === 'hybrid' ? `office ${wk.office}/${s.officeDaysPerWeek} · ` : ''}{Math.round(wk.hours)}h</span></div>
              {tg.length ? tg.map((x) => { const d = tDone(x, wk), g = Math.max(1, +x.goal || 1); return <div key={x.id}><div className="kv"><span>{x.text}</span><span>{d}/{g}</span></div><Bar v={Math.min(d, g)} max={g} /></div>; })
                : <p className="note">No targets set this week.</p>}
              {doc?.selfReview && <div className="quote">{doc.selfReview}</div>}
              {hr ? <FeedbackBox personId={p.id} name={name} w={w} status={doc?.seniorStatus || null} comment={doc?.seniorComment || ''} />
                : (doc?.seniorStatus || doc?.seniorComment) && (<>
                  {doc?.seniorStatus && <div className="row gap"><Chip c={SENIOR[doc.seniorStatus].c}>{SENIOR[doc.seniorStatus].l}</Chip></div>}
                  {doc?.seniorComment && <div className="quote">{doc.seniorComment}</div>}
                </>)}
            </article>
          );
        })}</div>
      </main>
    </>
  );
}
