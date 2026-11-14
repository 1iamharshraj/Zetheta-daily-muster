'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { Bar, Chip, Modal, PBar, useAction } from '@/components/ui';
import { LeaveModal } from '@/components/LeaveModal';
import { clockIn, clockOut, saveSummary, addTask, setTaskStatus, deleteTask, carryOver, setMetric, setBlocker, resolveBlocker } from '@/app/actions/day';
import { METRICS, TSTAT, modeLabel } from '@/lib/constants';
import { fmtLong, fmtShort, hm2m, hrs, kd, m2label, minsOf, num, tLabel, TZ } from '@/lib/time';
import type { Settings } from '@/lib/settings';
import type { Mode, Task, TaskStatus } from '@/lib/db/schema';

type D = {
  first: string; empNo: string; role: string; type: 'hybrid' | 'remote' | 'part'; metrics: string[];
  s: Settings; today: string; serverNow: number; nowMins: number; tag: string;
  rec: null | {
    mode: Mode | null; intent: Mode | null; checkInAt: string | null; checkOutAt: string | null; meetingNote: string | null;
    plan: Task[]; eod: string | null; metrics: Record<string, number>; blocker: { text: string; resolved?: boolean } | null;
    spot: 'yes' | 'no' | null; lateStatus: string | null; lateMins: number | null; lateExcused: boolean;
  };
  leave: null | { half: boolean; status: string; planned: boolean };
  carry: { from: string | null; count: number };
  goals: { pct: number | null; comment: string; items: { text: string; done: number; goal: number }[] };
  glance: { totalMarks: number; halfDays: number; balance: number; cl: number; el: number; lwp: number; office: number; worked: number; hours: number };
  coming: { k: string; name: string; sub: string }[];
  profilePct: number;
};

const fTS = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

/** Server-corrected clock that ticks every second. */
function useNow(serverNow: number) {
  const skew = useMemo(() => serverNow - Date.now(), [serverNow]);
  const [n, setN] = useState(() => new Date(serverNow));
  useEffect(() => { const id = setInterval(() => setN(new Date(Date.now() + skew)), 1000); return () => clearInterval(id); }, [skew]);
  return { now: n, skew };
}

function HeroArt({ hr }: { hr: number }) {
  if (hr >= 6 && hr < 17) {
    return (
      <div className="hello-art" aria-hidden="true"><svg viewBox="0 0 120 120">
        <g className="sunray" stroke="#FFD27A" strokeWidth="4" strokeLinecap="round" opacity=".9">
          {Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return <line key={i} x1={60 + Math.cos(a) * 34} y1={60 + Math.sin(a) * 34} x2={60 + Math.cos(a) * 48} y2={60 + Math.sin(a) * 48} />; })}
        </g>
        <circle cx="60" cy="60" r="24" fill="#FAA719" /><circle cx="60" cy="60" r="24" fill="url(#sg)" />
        <defs><radialGradient id="sg" cx=".35" cy=".35"><stop offset="0" stopColor="#FFE3A3" /><stop offset="1" stopColor="#F47625" stopOpacity=".2" /></radialGradient></defs>
      </svg></div>
    );
  }
  return (
    <div className="hello-art" aria-hidden="true"><svg viewBox="0 0 120 120">
      <path d="M74 26a34 34 0 1 0 20 52A28 28 0 0 1 74 26z" fill="#FFE3A3" />
      <circle className="twinkle" cx="28" cy="30" r="2.6" fill="#fff" /><circle className="twinkle" cx="100" cy="22" r="2" fill="#fff" /><circle className="twinkle" cx="20" cy="86" r="2.2" fill="#fff" />
    </svg></div>
  );
}

export function HomeClient({ d }: { d: D }) {
  const { s, rec, today } = d;
  const { now } = useNow(d.serverNow);
  const { run, pending, toast } = useAction();
  const router = useRouter();
  const modes: Mode[] = d.type === 'remote' ? ['remote', 'meeting'] : ['office', 'wfh', 'meeting'];
  const [mode, setMode] = useState<Mode>(rec?.intent && modes.includes(rec.intent) ? rec.intent : modes[0]);
  const [note, setNote] = useState(rec?.meetingNote || '');
  const [wrap, setWrap] = useState(false);
  const [leave, setLeave] = useState(false);
  const [blk, setBlk] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  const fullLeave = !!(d.leave && !d.leave.half);
  const nowM = minsOf(now), hr = Math.floor(nowM / 60);
  const hi = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  const doClockIn = () => {
    if (mode === 'meeting' && !note.trim()) { noteRef.current?.focus(); toast('Say where the meeting or event is, then tap Clock in.'); return; }
    run(() => clockIn(mode, note), () => setTimeout(() => { document.getElementById('sec-tasks')?.scrollIntoView({ block: 'start' }); document.getElementById('newtask')?.focus({ preventScroll: true }); }, 350));
  };

  let cta: React.ReactNode = null;
  if (!fullLeave) {
    if (!rec?.checkInAt) cta = <button className="btn primary sm" onClick={doClockIn} disabled={pending}><Icon n="clock" /> Clock in</button>;
    else if (!rec.checkOutAt) cta = <button className="btn sm out" onClick={() => setWrap(true)}><Icon n="clock" /> Clock out</button>;
    else cta = <button className="btn sm" onClick={() => setLeave(true)}>Apply leave</button>;
  }

  return (
    <>
      <Topbar title="Home">{cta}</Topbar>
      <main id="app" className="anim">
        <section className="hello">
          <div><h2>{hi}, {d.first}</h2><p className="hrole">{d.empNo}{d.role ? ' · ' + d.role : ''}</p></div>
          <span className="chip">{fmtLong(today)}{d.tag ? ' · ' + d.tag : ''}</span>
          <HeroArt hr={hr} />
        </section>
        <div className="quick">
          <Link className="qa" href="/attendance"><Icon n="cal" /><span>My attendance</span></Link>
          <a className="qa" href="#" onClick={(e) => { e.preventDefault(); setLeave(true); }}><Icon n="leave" /><span>Apply leave</span></a>
          <Link className="qa" href="/goals"><Icon n="goal" /><span>Weekly goals</span></Link>
          <Link className="qa" href="/rules"><Icon n="book" /><span>Rules</span></Link>
        </div>
        <div className="home">
          <div className="a-clock">
            <ClockCard d={d} now={now} mode={mode} setMode={setMode} modes={modes} note={note} setNote={setNote} noteRef={noteRef} onClockIn={doClockIn} onWrap={() => setWrap(true)} pending={pending} />
          </div>
          <div className="a-main">
            {!fullLeave && <TasksCard d={d} nowM={nowM} />}
            {!fullLeave && <NumbersCard d={d} />}
            <GoalsMini d={d} />
          </div>
          <div className="a-side">
            {d.profilePct < 100 && (
              <button type="button" className="card flagbtn" onClick={() => router.push('/profile')}>
                <Icon n="user" /><span><b>Your profile is {d.profilePct}% complete</b><PBar pct={d.profilePct} /><small>Needed for the statutory register of employees. Takes 2 minutes.</small></span>
              </button>
            )}
            {!fullLeave && (rec?.blocker?.text && !rec.blocker.resolved ? (
              <section className="card">
                <div className="sec-h"><h3><Icon n="flag" /> Your blocker</h3></div>
                <div className="blocker">{rec.blocker.text}</div>
                <p className="hint">The senior can see this.</p>
                <div className="row gap"><button className="btn sm" onClick={() => run(resolveBlocker)}>Mark resolved</button><button className="btn sm" onClick={() => setBlk(true)}>Edit</button></div>
              </section>
            ) : (
              <button type="button" className="card flagbtn" onClick={() => setBlk(true)}>
                <Icon n="flag" /><span><b>Stuck on something?</b><small>Flag a blocker and the senior sees it right away.</small></span>
              </button>
            ))}
            <Glance d={d} />
            <section className="card">
              <div className="sec-h"><h3>Coming up</h3></div>
              {d.coming.length ? (
                <ul className="upc">{d.coming.map((c) => (
                  <li key={c.k + c.name}><span className="dbadge"><b>{+c.k.slice(8)}</b><small>{kd(c.k).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' })}</small></span>
                    <span><b>{c.name}</b><small>{fmtShort(c.k)} · {c.sub}</small></span></li>
                ))}</ul>
              ) : (<><p className="hint">No holidays or leave coming up.</p><button className="btn" onClick={() => setLeave(true)}>Apply leave</button></>)}
            </section>
          </div>
        </div>
      </main>
      {wrap && <WrapModal d={d} onClose={() => setWrap(false)} />}
      {leave && <LeaveModal s={s} today={today} onClose={() => setLeave(false)} goToLeave />}
      {blk && <BlockerModal initial={rec?.blocker && !rec.blocker.resolved ? rec.blocker.text : ''} onClose={() => setBlk(false)} />}
    </>
  );
}

function lateChip(d: D) {
  const r = d.rec!;
  if (d.type === 'part') return null;
  if ((r.lateStatus === 'late' || r.lateStatus === 'severe') && r.lateExcused) return <Chip c="info">Late · excused</Chip>;
  if (r.lateStatus === 'severe') return <Chip c="bad">Late {r.lateMins} min · half day</Chip>;
  if (r.lateStatus === 'late') return <Chip c="warn">Late {r.lateMins} min</Chip>;
  return <Chip c="ok">On time</Chip>;
}
const spotChip = (sp: string | null) => (sp === 'yes' ? <Chip c="ok">Spot check: in office</Chip> : sp === 'no' ? <Chip c="bad">Spot check: not in office</Chip> : null);

function ClockCard({ d, now, mode, setMode, modes, note, setNote, noteRef, onClockIn, onWrap, pending }: {
  d: D; now: Date; mode: Mode; setMode: (m: Mode) => void; modes: Mode[]; note: string; setNote: (v: string) => void;
  noteRef: React.RefObject<HTMLInputElement | null>; onClockIn: () => void; onWrap: () => void; pending: boolean;
}) {
  const { s, rec } = d;
  const st = hm2m(s.officeStart), ge = st + +s.graceMin, eb = hm2m(s.eodBy);
  if (d.leave && !d.leave.half) {
    return (
      <section className="card clock"><div className="eyebrow">Today</div><div className="big-state">You’re on leave</div>
        <div className="row center">{d.leave.status === 'pending' ? <Chip c="mute">Awaiting HR approval</Chip> : <Chip c={d.leave.planned ? 'info' : 'bad'}>{d.leave.planned ? 'Planned leave' : 'Unplanned leave'}</Chip>}</div>
        <p className="cl-hint">Enjoy your day. Nothing to do here.</p></section>
    );
  }
  if (!rec?.checkInAt) {
    const lbl: Record<Mode, string> = { office: 'Office', wfh: 'Home', remote: 'Remote', meeting: 'Meeting / Event' };
    const m = minsOf(now);
    return (
      <section className="card clock" id="sec-checkin">
        <div className="eyebrow">Work hours · {m2label(st)} – {m2label(eb)}</div>
        <div className="bigclock">{fTS.format(now).toUpperCase()}</div>
        <div className="modes" role="radiogroup" aria-label="Where are you working today?">
          {modes.map((x) => <button key={x} type="button" role="radio" aria-checked={x === mode} className={'mode ' + (x === mode ? 'on' : '')} onClick={() => { setMode(x); if (x === 'meeting') setTimeout(() => noteRef.current?.focus(), 30); }}>{lbl[x]}</button>)}
        </div>
        {mode === 'meeting' && <input ref={noteRef} type="text" maxLength={120} placeholder="Where and with whom? e.g. Demo at KJSIM with the TPO" value={note} onChange={(e) => setNote(e.target.value)} />}
        <button className="btn primary xl" onClick={onClockIn} disabled={pending}><Icon n="clock" /> {pending ? 'Clocking in…' : 'Clock in'}</button>
        {d.type === 'part' ? <p className="cl-hint">Part-time: clock in on the days you work.</p>
          : mode === 'meeting' ? <p className="cl-hint">No late mark for meetings and events.</p>
          : <p className={'cl-hint' + (m > ge ? ' late' : '')}>{m <= ge ? `On time if you clock in before ${m2label(ge)}` : `Clocking in now counts as late (+${m - st} min)`}</p>}
      </section>
    );
  }
  if (!rec.checkOutAt) {
    const sec = Math.max(0, Math.floor((now.getTime() - Date.parse(rec.checkInAt)) / 1000));
    const el = [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60].map((x) => String(x).padStart(2, '0')).join(':');
    const full = Math.max(1, (+s.weeklyHours || 40) / 5);
    return (
      <section className="card clock on" id="sec-checkin">
        <div className="eyebrow">Clocked in · {modeLabel(rec.mode)}</div>
        <div className="bigclock">{el}</div>
        <div className="row gap wrap center"><Chip c="mute">In at {tLabel(rec.checkInAt)}</Chip>{lateChip(d)}{spotChip(rec.spot)}</div>
        {rec.meetingNote && <p className="cl-hint">At: {rec.meetingNote}</p>}
        <div><div className="bar"><i style={{ width: Math.min(100, Math.round((100 * sec) / 3600 / full)) + '%' }} /></div>
          <p className="cl-hint" style={{ marginTop: 4 }}>progress through an {Math.round(full)}-hour day</p></div>
        <button className="btn xl out" onClick={onWrap}><Icon n="clock" /> Clock out</button>
        <p className="cl-hint">You’ll write a 2–3 line summary of your day first.</p>
      </section>
    );
  }
  return (
    <section className="card clock" id="sec-checkin">
      <div className="eyebrow">Day complete</div>
      <div className="bigclock">{hrs((Date.parse(rec.checkOutAt) - Date.parse(rec.checkInAt)) / 36e5)}</div>
      <div className="row gap wrap center"><Chip c="mute">In {tLabel(rec.checkInAt)}</Chip><Chip c="mute">Out {tLabel(rec.checkOutAt)}</Chip>{lateChip(d)}</div>
      <button className="link" style={{ alignSelf: 'center' }} onClick={onWrap}>View or edit today’s summary</button>
    </section>
  );
}

function TasksCard({ d, nowM }: { d: D; nowM: number }) {
  const plan = d.rec?.plan || [];
  const [text, setText] = useState('');
  const { run, pending } = useAction();
  const pb = hm2m(d.s.planBy);
  const cnt: Partial<Record<TaskStatus, number>> = {};
  plan.forEach((x) => { cnt[x.status] = (cnt[x.status] || 0) + 1; });
  const done = cnt.done || 0;
  const add = () => { const v = text.trim(); if (!v) return; setText(''); run(() => addTask(v), () => document.getElementById('newtask')?.focus()); };
  return (
    <section className="card" id="sec-tasks">
      <div className="sec-h"><h3>Today’s tasks</h3>
        {!plan.length ? (d.rec?.checkInAt && nowM > pb ? <Chip c="warn">Overdue · due {m2label(pb)}</Chip> : <Chip c="mute">Plan by {m2label(pb)}</Chip>)
          : <Chip c={done === plan.length ? 'ok' : 'mute'}>{done} of {plan.length} completed</Chip>}
      </div>
      {plan.length ? (<>
        <Bar v={done} max={plan.length} />
        <div className="tsum">{(Object.keys(TSTAT) as TaskStatus[]).filter((k) => cnt[k]).map((k) => <Chip key={k} c={TSTAT[k].c}>{cnt[k]} {TSTAT[k].l.toLowerCase()}</Chip>)}</div>
        <div className="ttab" role="table" aria-label="Today’s tasks">
          <div className="trow th" role="row"><span className="tn">#</span><span className="ttx">Task</span><span>Status</span><span /></div>
          {plan.map((x, j) => (
            <div key={x.id} className={'trow s-' + x.status}>
              <span className="tn">{j + 1}</span>
              <span className="ttx">{x.text}{x.carried && <> <em className="carried">carried over</em></>}</span>
              <select className={'stsel s-' + x.status} value={x.status} aria-label={`Status of task ${j + 1}`} onChange={(e) => run(() => setTaskStatus(x.id, e.target.value as TaskStatus))}>
                {(Object.keys(TSTAT) as TaskStatus[]).map((k) => <option key={k} value={k}>{TSTAT[k].l}</option>)}
              </select>
              <button className="x" onClick={() => run(() => deleteTask(x.id))} aria-label={`Remove task ${j + 1}`}>×</button>
            </div>
          ))}
        </div>
      </>) : <p className="hint">What will you work on today? Add each task below, then keep its status up to date through the day.</p>}
      <div className="add">
        <input id="newtask" type="text" maxLength={200} placeholder="Type a task and press Enter" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn primary" onClick={add} disabled={pending}>Add task</button>
      </div>
      {d.carry.count > 0 && !plan.some((x) => x.carried) && (
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => run(carryOver)}>+ Bring {d.carry.count} open task{d.carry.count > 1 ? 's' : ''} from {fmtShort(d.carry.from!)}</button>
      )}
    </section>
  );
}

function NumbersCard({ d }: { d: D }) {
  const ms = d.metrics.filter((m) => METRICS[m]);
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(ms.map((m) => [m, +(d.rec?.metrics?.[m] || 0)])));
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { run } = useAction();
  if (!ms.length) return null;
  const set = (m: string, v: number) => {
    const n = Math.max(0, Math.floor(v || 0));
    setVals((o) => ({ ...o, [m]: n }));
    clearTimeout(timers.current[m]);
    timers.current[m] = setTimeout(() => run(() => setMetric(m, n)), 450);
  };
  return (
    <section className="card" id="sec-numbers">
      <div className="sec-h"><h3>Today’s numbers</h3><span className="count">tap + as you go</span></div>
      <div className="steppers">{ms.map((m) => (
        <div className="stepper" key={m}><span className="lbl">{METRICS[m]}</span>
          <div className="ctl">
            <button className="btn sq" onClick={() => set(m, vals[m] - 1)} aria-label={`Decrease ${METRICS[m]}`}>−</button>
            <input type="number" min={0} inputMode="numeric" value={vals[m]} onChange={(e) => set(m, +e.target.value)} aria-label={METRICS[m]} />
            <button className="btn sq" onClick={() => set(m, vals[m] + 1)} aria-label={`Increase ${METRICS[m]}`}>+</button>
          </div>
        </div>
      ))}</div>
    </section>
  );
}

function GoalsMini({ d }: { d: D }) {
  const g = d.goals;
  return (
    <section className="card">
      <div className="sec-h"><h3>This week’s goals</h3><Link className="btn sm" href="/goals">{g.items.length ? 'Open goals' : 'Set goals'}</Link></div>
      {g.items.length ? (<>
        <div className="pctrow"><span className="pct">{g.pct}%</span><span className="muted">achieved so far</span></div>
        {g.items.map((x, i) => (<div key={i}><div className="kv"><span>{x.text}</span><span>{x.done}/{x.goal}</span></div><Bar v={Math.min(x.done, x.goal)} max={x.goal} /></div>))}
      </>) : (<>
        <p className="hint">No goals for this week yet. Set 3–5; the ones linked to your numbers update by themselves.</p>
        <Link className="btn primary" href="/goals">Set this week’s goals</Link>
      </>)}
      {g.comment && <div className="quote"><b>Senior:</b> {g.comment}</div>}
    </section>
  );
}

function Glance({ d }: { d: D }) {
  const s = d.s, g = d.glance, router = useRouter();
  if (d.type === 'part') {
    return (
      <section className="card"><div className="sec-h"><h3>This week</h3><Link className="btn sm" href="/attendance">View attendance</Link></div>
        <dl className="stats"><div><dt>Days worked</dt><dd>{g.worked}</dd></div><div><dt>Hours</dt><dd>{Math.round(g.hours)}</dd></div></dl></section>
    );
  }
  const N = Math.max(1, +s.latesPerHalfDay), cur = g.totalMarks % N, od = +s.officeDaysPerWeek;
  return (
    <section className="card"><div className="sec-h"><h3>At a glance</h3><Link className="btn sm" href="/attendance">View attendance</Link></div>
      <dl className="stats">
        <div className={(cur ? 'warnv ' : '') + 'clickable'} onClick={() => router.push('/rules')} title={`Every ${N} late marks in a month cut half a day of leave.`}>
          <dt>Late marks</dt><dd>{g.totalMarks}<span className="lmdots" aria-hidden="true">{Array.from({ length: N }, (_, j) => (j < cur ? '●' : '○')).join('')}</span></dd>
          <small>{g.totalMarks ? `${N - cur} more = half-day cut` : 'this month'}</small></div>
        <div className={(g.lwp ? 'badv ' : '') + 'clickable'} onClick={() => router.push('/leave')}>
          <dt>Leave left</dt><dd>{num(g.balance)}</dd><small>{num(g.cl)} casual · {num(g.el)} earned{g.lwp ? ' · ' + num(g.lwp) + ' unpaid' : ''}</small></div>
        {d.type === 'hybrid'
          ? <div className={g.office < od ? 'warnv' : ''}><dt>Office days</dt><dd>{g.office}/{od}</dd><small>this week · events count</small></div>
          : <div><dt>Days worked</dt><dd>{g.worked}</dd><small>this week</small></div>}
        <div><dt>Hours</dt><dd>{Math.round(g.hours)}/{s.weeklyHours}</dd><small>this week</small></div>
      </dl>
    </section>
  );
}

function WrapModal({ d, onClose }: { d: D; onClose: () => void }) {
  const rec = d.rec!;
  const plan = rec.plan || [], dn = plan.filter((x) => x.status === 'done').length, out = !!rec.checkOutAt;
  const [sum, setSum] = useState(rec.eod || '');
  const { run, pending } = useAction();
  const ok = sum.trim().length >= 10;
  return (
    <Modal title={out ? 'Today’s summary' : 'Wrap up your day'} onClose={onClose}>
      {plan.length > 0 && <p className="muted">You finished {dn} of {plan.length} tasks today.{dn < plan.length ? ' Unfinished ones can be carried over tomorrow in one tap.' : ''}</p>}
      <label className="fl">What did you get done, and what carries over to tomorrow?
        <textarea rows={5} maxLength={1200} value={sum} onChange={(e) => setSum(e.target.value)} placeholder="e.g. Called 14 employers, booked 2 demos (HDFC Sec, Axis). Pending: MoU draft for Kotak." />
      </label>
      <div className="row end gap wrap">
        <span className="note">{ok ? 'Ready when you are.' : 'Write at least a sentence.'}</span>
        {out ? <button className="btn primary" disabled={pending || !ok} onClick={() => run(() => saveSummary(sum), onClose)}>Save summary</button>
          : <button className="btn primary" disabled={pending || !ok} onClick={() => run(() => clockOut(sum), onClose)}>Submit &amp; clock out</button>}
      </div>
    </Modal>
  );
}

function BlockerModal({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const { run, pending } = useAction();
  return (
    <Modal title="Flag a blocker" onClose={onClose}>
      <label className="fl">What’s stopping you, and who or what are you waiting on?
        <textarea rows={4} maxLength={400} value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Need the updated demo deck from Shama before the HDFC call." />
      </label>
      <div className="row end gap"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={pending} onClick={() => run(() => setBlocker(v), onClose)}>Flag it</button></div>
    </Modal>
  );
}
