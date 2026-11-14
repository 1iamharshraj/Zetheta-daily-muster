'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Chip, useAction } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { spotCheck } from '@/app/actions/hr';
import { addD, fmtLong, TZ } from '@/lib/time';

export type PulseRow = {
  id: number; name: string; empNo: string; role: string; photo: string | null; chip: [string, string];
  tasks: [number, number]; blocked: boolean; canSpot: boolean;
  f: { office: boolean; meeting: boolean; remote: boolean; late: boolean; missing: boolean; leave: boolean };
};
export type Attn = { id: number; name: string; txt: string; c: string };
type F = keyof PulseRow['f'];

function Ring({ p, label, cls }: { p: number; label: string; cls: string }) {
  const r = 26, c = 2 * Math.PI * r, o = c * (1 - Math.min(100, p) / 100);
  return (
    <div className="ring"><svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${p}%`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunk)" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={`var(--${cls})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={c.toFixed(1)} strokeDashoffset={o.toFixed(1)} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle" className="rt">{p}%</text>
    </svg>{label}</div>
  );
}

const fTS = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
function LiveClock({ serverNow }: { serverNow: number }) {
  const skew = useMemo(() => serverNow - Date.now(), [serverNow]);
  const [n, setN] = useState<Date | null>(null);
  useEffect(() => { const f = () => setN(new Date(Date.now() + skew)); f(); const id = setInterval(f, 1000); return () => clearInterval(id); }, [skew]);
  return <div className="bigclock sm">{n ? fTS.format(n).toUpperCase() : ''}</div>;
}

export function TeamClient({ d, today, serverNow, rows, attn, workday = true }: { d: string; today: string; serverNow: number; rows: PulseRow[]; attn: Attn[] | null; workday?: boolean }) {
  const [tf, setTf] = useState<F | null>(null);
  const router = useRouter();
  const { run } = useAction();
  const c = Object.fromEntries((['office', 'meeting', 'remote', 'late', 'missing', 'leave'] as F[]).map((k) => [k, rows.filter((r) => r.f[k]).length])) as Record<F, number>;
  const present = c.office + c.meeting + c.remote;
  // On weekends/holidays only the people who chose to work count, so the rings stay meaningful.
  const expected = workday ? rows.filter((r) => r.chip[0] !== 'Not working today' && r.chip[0] !== 'Not signed in yet' && !r.f.leave).length || rows.length : present;
  const pc = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const TL: Record<F, string> = { office: 'In office', meeting: 'At meetings / events', remote: 'Home / remote', late: 'Late', missing: d < today ? 'Absent' : 'Not in yet', leave: 'On leave' };
  const shown = tf ? rows.filter((r) => r.f[tf]) : rows;
  const tile = (k: F, cls: string) => (
    <button key={k} type="button" className={`tile ${c[k] && cls ? cls : ''} ${tf === k ? 'on' : ''}`} aria-pressed={tf === k} onClick={() => setTf(tf === k ? null : k)}>
      <b>{c[k]}</b><span>{TL[k]}</span>
    </button>
  );
  if (!rows.length) return <main id="app"><section className="card empty-state"><h2>No team yet</h2><p className="muted">HR adds the team in Settings.</p></section></main>;
  return (
    <main id="app" className="anim">
      <section className="card hero">
        <div>
          <div className="eyebrow">{d === today ? 'Live · ' : ''}{fmtLong(d)}</div>
          <div className="hero-n">{workday ? <><b>{present}</b> of {expected} {d === today ? 'working right now' : 'worked that day'}</> : <><b>{present}</b> working · not a working day</>}</div>
          <p className="muted">{c.late} late · {c.missing} {d < today ? 'absent' : 'not in yet'} · {c.leave} on leave</p>
          <div className="row gap wrap" style={{ marginTop: 10 }}>
            <Link className="btn sm" href={`/team?d=${addD(d, -1)}`}>← Previous day</Link>
            {d === today ? <button className="btn sm" disabled>Today</button> : <Link className="btn sm" href="/team">Today</Link>}
            {d >= today ? <button className="btn sm" disabled>Next day →</button> : <Link className="btn sm" href={`/team?d=${addD(d, 1)}`}>Next day →</Link>}
          </div>
        </div>
        <div className="hero-r">
          {d === today && <LiveClock serverNow={serverNow} />}
          <div className="rings"><Ring p={pc(present, expected)} label="Present" cls="ok" /><Ring p={pc(c.late, present)} label="Late" cls="warn" /><Ring p={pc(c.remote, present)} label="Remote" cls="info" /></div>
        </div>
      </section>
      <div className="tiles6">{tile('office', 'ok')}{tile('meeting', '')}{tile('remote', '')}{tile('late', 'warn')}{tile('missing', 'bad')}{tile('leave', '')}</div>
      <div className={attn ? 'ov' : ''}>
        <section className="card">
          <div className="sec-h"><h3>{tf ? `${TL[tf]} (${shown.length})` : 'Team pulse'}</h3>
            {tf ? <button className="btn sm" onClick={() => setTf(null)}>Show everyone</button> : <span className="count">tap anyone for details</span>}</div>
          {shown.length ? (
            <ul className="pulse">{shown.map((r) => (
              <li key={r.id} className="pr clickable" onClick={() => router.push(`/team/${r.id}`)}>
                <Avatar name={r.name} photo={r.photo} />
                <span className="pn"><b>{r.name}</b><small>{r.empNo}{r.role ? ` · ${r.role}` : ''}</small>
                  {r.canSpot && (
                    <span className="spot" onClick={(e) => e.stopPropagation()}><span className="note">Spot check:</span>
                      <button className="btn sm" title="Seen in office" onClick={() => run(() => spotCheck(r.id, d, 'yes'))}>Seen</button>
                      <button className="btn sm" title="Not in office" onClick={() => run(() => spotCheck(r.id, d, 'no'))}>Not in</button>
                    </span>
                  )}
                </span>
                <span className="pr-r"><Chip c={r.chip[1]}>{r.chip[0]}</Chip>
                  <span className="pt" title="Tasks done">{r.tasks[1] ? `${r.tasks[0]}/${r.tasks[1]} completed` : ''}</span>
                  {r.blocked && <span className="bdot" title="Blocked, needs help">!</span>}
                </span>
                <Icon n="chev" />
              </li>
            ))}</ul>
          ) : <p className="note">Nobody in this group.</p>}
        </section>
        {attn && (
          <div className="col">
            {attn.length ? (
              <section className="card"><div className="sec-h"><h3>Needs your attention</h3><span className="count">{attn.length} item{attn.length > 1 ? 's' : ''}</span></div>
                <ul className="alist">{attn.map((a, j) => {
                  const href = a.id ? `/team/${a.id}` : '/hr/settings#pending';
                  return (
                    <li key={j} className="clickable" onClick={() => router.push(href)}>
                      <span className={'adot ' + a.c} aria-hidden="true" /><Link className="link" href={href}>{a.name}</Link>
                      <span className="atext">{a.txt}</span><span className="go" aria-hidden="true">→</span>
                    </li>
                  );
                })}</ul>
              </section>
            ) : (
              <section className="card"><div className="sec-h"><h3>Needs your attention</h3><Chip c="ok">All clear</Chip></div><p className="hint">Nobody is late, missing or blocked right now.</p></section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
