'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Chip, useAction } from '@/components/ui';
import { addTarget, stepTarget, deleteTarget, saveSelfReview } from '@/app/actions/week';
import { METRICS, SENIOR } from '@/lib/constants';
import { addD, fmtShort } from '@/lib/time';
import type { Settings } from '@/lib/settings';
import type { SeniorStatus, Target } from '@/lib/db/schema';

export function GoalsClient({ w, thisWeek, type, metrics, s, targets, pct, selfReview, senior, wk }: {
  w: string; thisWeek: string; type: string; metrics: string[]; s: Settings;
  targets: (Target & { cur: number })[]; pct: number | null; selfReview: string;
  senior: { status: SeniorStatus | null; comment: string };
  wk: { office: number; worked: number; hours: number; metrics: Record<string, number> };
}) {
  const ms = metrics.filter((m) => METRICS[m]);
  const [text, setText] = useState('');
  const [metric, setMetric] = useState('');
  const [goal, setGoal] = useState(5);
  const [rev, setRev] = useState(selfReview);
  const { run, pending } = useAction();
  const add = () => run(() => addTarget(w, text, metric || null, goal), () => { setText(''); setGoal(5); });
  return (
    <>
      <div className="toolbar"><h2>Week of {fmtShort(w)}</h2>
        <div className="row gap">
          <Link className="btn sm" href={`/goals?w=${addD(w, -7)}`}>← Previous</Link>
          {w === thisWeek ? <button className="btn sm" disabled>This week</button> : <Link className="btn sm" href="/goals">This week</Link>}
          <Link className="btn sm" href={`/goals?w=${addD(w, 7)}`}>Next →</Link>
        </div>
      </div>
      <div className="cols">
        <div className="col">
          <section className="card">
            <div className="sec-h"><h3>Weekly targets</h3><span className="count">{pct == null ? 'none set' : pct + '% achieved'}</span></div>
            <p className="hint">Set 3–5 targets on Monday. Link one to a daily number and it updates by itself; otherwise use + and −.</p>
            <div>{targets.length ? targets.map((x) => {
              const g = Math.max(1, +x.goal || 1);
              return (
                <div className="target" key={x.id}>
                  <div className="top-r"><span>{x.text}</span>
                    <span className="row gap">
                      {x.metric ? <Chip c="info">Auto · {METRICS[x.metric] || x.metric}</Chip> : (<>
                        <button className="btn sq" onClick={() => run(() => stepTarget(w, x.id, -1))} aria-label="Decrease">−</button>
                        <button className="btn sq" onClick={() => run(() => stepTarget(w, x.id, 1))} aria-label="Increase">+</button>
                      </>)}
                      <span className="count">{x.cur}/{g}</span>
                      <button className="x" onClick={() => run(() => deleteTarget(w, x.id))} aria-label="Remove target">×</button>
                    </span>
                  </div>
                  <div className="bar"><i style={{ width: Math.min(100, Math.round((100 * x.cur) / g)) + '%' }} /></div>
                </div>
              );
            }) : <p className="note">No targets for this week yet. Add your first one below.</p>}</div>
            <div className="form">
              <label className="wide">Target<input id="tg-text" type="text" maxLength={160} placeholder="e.g. Book 5 employer demos" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
              <label>Track it using<select value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="">+ / − buttons (manual)</option>{ms.map((m) => <option key={m} value={m}>{METRICS[m]}</option>)}</select></label>
              <label>Goal<input type="number" min={1} value={goal} onChange={(e) => setGoal(+e.target.value)} /></label>
            </div>
            <div className="row end"><button className="btn" onClick={add} disabled={pending}>Add target</button></div>
          </section>
          <section className="card">
            <div className="sec-h"><h3>Self-review</h3></div>
            <p className="hint">On Friday: what went well, what slipped, and what you need from the senior.</p>
            <textarea rows={3} maxLength={1200} value={rev} onChange={(e) => setRev(e.target.value)} placeholder="Friday: what went well, what slipped, what you need." />
            <div className="row end"><button className="btn primary" disabled={pending} onClick={() => run(() => saveSelfReview(w, rev))}>Save review</button></div>
          </section>
        </div>
        <div className="col">
          <section className="card"><div className="sec-h"><h3>This week</h3></div>
            <dl className="stats">
              {type === 'hybrid' ? <div><dt>Office days</dt><dd>{wk.office}/{s.officeDaysPerWeek}</dd></div> : <div><dt>Days worked</dt><dd>{wk.worked}</dd></div>}
              <div><dt>Hours</dt><dd>{Math.round(wk.hours)}/{s.weeklyHours}</dd></div>
              {ms.map((m) => <div key={m}><dt>{METRICS[m]}</dt><dd>{wk.metrics[m] || 0}</dd></div>)}
            </dl>
          </section>
          <section className="card">
            <div className="sec-h"><h3>Senior’s feedback</h3>{senior.status && <Chip c={SENIOR[senior.status].c}>{SENIOR[senior.status].l}</Chip>}</div>
            {senior.comment ? <div className="quote">{senior.comment}</div> : <p className="note">Nothing yet for this week.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
