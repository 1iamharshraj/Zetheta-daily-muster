'use client';
import { useState } from 'react';
import { Avatar, Chip, Modal, useAction } from '@/components/ui';
import { saveSettings, addPerson, updatePerson, approvePending, linkPending, removePending, resetPassword, resetTotp, unlinkAccount } from '@/app/actions/settings';
import { METRICS, WORKTYPE } from '@/lib/constants';
import type { Settings } from '@/lib/settings';
import type { WorkType } from '@/lib/db/schema';

const mask = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); let o = d.slice(0, 2); if (d.length > 2) o += '-' + d.slice(2, 4); if (d.length > 4) o += '-' + d.slice(4); return o; };

export function RulesForm({ s, channels }: { s: Settings; channels: { email: boolean; push: boolean } }) {
  const [v, setV] = useState({
    ...s, holidays: s.holidays.join('\n'), gamesdays: s.gamesdays.join('\n'),
    remindEmail: s.reminders?.email !== false, remindPush: s.reminders?.push !== false,
  });
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  const { run, pending } = useAction();
  const num = (k: keyof Settings, l: string, min = 0, step = 1) => (
    <label>{l}<input type="number" min={min} step={step} value={String(v[k] as number)} onChange={(e) => set(k, e.target.value)} /></label>
  );
  const time = (k: 'officeStart' | 'planBy' | 'eodBy', l: string) => <label>{l}<input type="time" value={v[k]} onChange={(e) => set(k, e.target.value)} /></label>;
  return (
    <section className="card"><div className="sec-h"><h3>Rules</h3><span className="count">everyone sees these on the Rules page</span></div>
      <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
        {time('officeStart', 'Day starts')}{num('graceMin', 'Grace period (min)')}{num('latesPerHalfDay', 'Late marks per half-day cut', 1)}
        {num('severeLateMin', 'Half day if later than (min)', 1)}{time('planBy', 'Tasks due by')}{time('eodBy', 'Summary due by')}
        {num('officeDaysPerWeek', 'Office days per week')}{num('weeklyHours', 'Hours per week', 1)}{num('casualLeave', 'Casual leave per year')}
        {num('earnedLeave', 'Earned leave per year')}{num('dailyMaxHours', 'Overtime after (hours/day)', 1, 0.5)}{num('weeklyMaxHours', 'Max hours per week', 1)}
        <label>Leave year starts<select value={v.leaveYearStartMonth} onChange={(e) => set('leaveYearStartMonth', +e.target.value)}>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
        <label>Rules count from<input type="text" inputMode="numeric" placeholder="dd-mm-yyyy" maxLength={10} value={v.goLive} onChange={(e) => set('goLive', mask(e.target.value))} /></label>
        <label className="chk" style={{ color: 'var(--ink)', gridColumn: '1/-1' }}><input type="checkbox" checked={v.lateAppliesToWfh} onChange={(e) => set('lateAppliesToWfh', e.target.checked)} />Late marks on WFH and Remote days too</label>
        <div className="wide" style={{ gridColumn: '1/-1' }}><span className="note">Working days</span>
          <div className="row gap wrap" style={{ marginTop: 4 }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <label key={d} className="chk"><input type="checkbox" checked={v.workdays.includes(i)} onChange={(e) => set('workdays', e.target.checked ? [...v.workdays, i] : v.workdays.filter((x) => x !== i))} />{d}</label>
          ))}</div></div>
        <label className="wide" style={{ gridColumn: '1/-1' }}>Holidays (one per line: dd-mm-yyyy name)<textarea rows={4} placeholder="25-12-2026 Christmas" value={v.holidays} onChange={(e) => set('holidays', e.target.value)} /></label>
        <label className="wide" style={{ gridColumn: '1/-1' }}>Gamesdays (one per line: dd-mm-yyyy)<textarea rows={2} placeholder="04-12-2026" value={v.gamesdays} onChange={(e) => set('gamesdays', e.target.value)} /></label>
        <div className="wide" style={{ gridColumn: '1/-1' }}><span className="note">Reminders (not checked in by {v.officeStart} + grace, no tasks by {v.planBy}, no summary by {v.eodBy}, Monday targets, Friday review)</span>
          <div className="row gap wrap" style={{ marginTop: 4 }}>
            <label className="chk"><input type="checkbox" checked={v.remindEmail} onChange={(e) => set('remindEmail', e.target.checked)} />Email {channels.email ? '' : <small className="muted">(SMTP not set up)</small>}</label>
            <label className="chk"><input type="checkbox" checked={v.remindPush} onChange={(e) => set('remindPush', e.target.checked)} />Browser push {channels.push ? '' : <small className="muted">(VAPID keys not set up)</small>}</label>
          </div></div>
      </div>
      <div className="row end"><button className="btn primary" disabled={pending} onClick={() => run(() => saveSettings(v as unknown as Record<string, unknown>))}>Save rules</button></div>
    </section>
  );
}

type P = { id: number; name: string; fullName: string; role: string; email: string; empNo: string; type: WorkType; active: boolean; metrics: string[]; isHr: boolean; isSuperadmin: boolean; hasAccount: boolean; totpOn: boolean; lastSignIn: string | null };

function RosterRow({ p, meId, superadmin }: { p: P; meId: number; superadmin: boolean }) {
  const [v, setV] = useState(p);
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const dirty = JSON.stringify(v) !== JSON.stringify(p);
  const set = (k: keyof P, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  const locked = (p.isHr || p.isSuperadmin) && !superadmin && p.id !== meId;
  return (
    <div className="rrow">
      <input type="text" value={v.name} placeholder="Name" aria-label="Display name" title={`Full name: ${p.fullName}. Changing this replaces only the first name.`} onChange={(e) => set('name', e.target.value)} />
      <input type="text" value={v.role} placeholder="Role" aria-label="Role" onChange={(e) => set('role', e.target.value)} />
      <input type="email" value={v.email} placeholder="Work email" aria-label="Email" readOnly={locked} title={locked ? 'Only a superadmin can change an HR account’s email.' : undefined} onChange={(e) => set('email', e.target.value)} />
      <input type="text" value={p.empNo} readOnly aria-label="Employee code" title="Employee codes are fixed and never reused." />
      <select value={v.type} aria-label="Work pattern" onChange={(e) => set('type', e.target.value)}>
        {(Object.keys(WORKTYPE) as WorkType[]).map((k) => <option key={k} value={k}>{WORKTYPE[k]}</option>)}</select>
      <label className="chk"><input type="checkbox" checked={v.active} disabled={p.id === meId || locked} onChange={(e) => set('active', e.target.checked)} />Active</label>
      <span className="row gap">
        <button className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Less' : 'More'}</button>
        {dirty && <button className="btn primary sm" disabled={pending} onClick={() => run(() => updatePerson(p.id, v))}>Save</button>}
      </span>
      {open && (
        <div className="mets">
          {Object.keys(METRICS).map((m) => (
            <label key={m}><input type="checkbox" checked={v.metrics.includes(m)} onChange={(e) => set('metrics', e.target.checked ? [...v.metrics, m] : v.metrics.filter((x) => x !== m))} />{METRICS[m]}</label>
          ))}
          <label style={{ fontWeight: 600 }} title={superadmin ? '' : 'Only a superadmin can change this.'}><input type="checkbox" checked={v.isHr || v.isSuperadmin} disabled={!superadmin || p.id === meId || v.isSuperadmin} onChange={(e) => set('isHr', e.target.checked)} />HR access</label>
          <label style={{ fontWeight: 600 }} title={superadmin ? 'Superadmins manage who has HR access.' : 'Only a superadmin can change this.'}><input type="checkbox" checked={v.isSuperadmin} disabled={!superadmin || p.id === meId} onChange={(e) => setV((o) => ({ ...o, isSuperadmin: e.target.checked, isHr: e.target.checked || o.isHr }))} />Superadmin</label>
        </div>
      )}
    </div>
  );
}

export function Roster({ people, meId, superadmin }: { people: P[]; meId: number; superadmin: boolean }) {
  const [add, setAdd] = useState(false);
  const [n, setN] = useState({ fullName: '', role: '', email: '', type: 'hybrid' as WorkType });
  const { run, pending } = useAction();
  return (
    <section className="card"><div className="sec-h"><h3>Team</h3><span className="count">{people.filter((p) => p.active).length} active</span></div>
      <p className="note">Add everyone here with their email so they can create a password and get linked automatically. Use “More” to pick the daily numbers each person reports{superadmin ? ' and to give HR or superadmin access' : ''}. Untick “Active” for people who leave; their history stays.</p>
      <div className="rost">{people.map((p) => <RosterRow key={p.id + JSON.stringify(p)} p={p} meId={meId} superadmin={superadmin} />)}</div>
      <div className="row between wrap gap"><button className="btn" onClick={() => setAdd(true)}>Add person</button></div>
      {add && (
        <Modal title="Add a person" onClose={() => setAdd(false)}>
          <div className="form">
            <label className="wide">Full name<input type="text" maxLength={80} value={n.fullName} onChange={(e) => setN({ ...n, fullName: e.target.value })} placeholder="As in their documents" /></label>
            <label>Role<input type="text" maxLength={80} value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })} placeholder="e.g. Employer Marketing" /></label>
            <label>Work pattern<select value={n.type} onChange={(e) => setN({ ...n, type: e.target.value as WorkType })}>
              {(Object.keys(WORKTYPE) as WorkType[]).map((k) => <option key={k} value={k}>{WORKTYPE[k]}</option>)}</select></label>
            <label className="wide">Email (they sign in with this)<input type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} placeholder="name@zetheta.com or name@gmail.com" /></label>
          </div>
          <p className="note">They get the next employee code automatically. Daily numbers are picked from the role; change them with “More”.</p>
          <div className="row end gap"><button className="btn" onClick={() => setAdd(false)}>Cancel</button>
            <button className="btn primary" disabled={pending} onClick={() => run(() => addPerson(n), () => { setAdd(false); setN({ fullName: '', role: '', email: '', type: 'hybrid' }); })}>Add person</button></div>
        </Modal>
      )}
    </section>
  );
}

export function Pending({ pending, free }: { pending: { id: number; name: string; email: string; empNo: string }[]; free: { id: number; name: string }[] }) {
  return (
    <section className="card start" id="pending"><div className="sec-h"><h3>New registrations</h3><span className="count">{pending.length} waiting</span></div>
      <p className="hint">These people created an account themselves. They can’t use the muster until you add them to the team, or link them to a name that’s already on the list (for example someone signing in with a Gmail ID).</p>
      <ul className="pulse">{pending.map((p) => <PendingRow key={p.id} p={p} free={free} />)}</ul>
    </section>
  );
}
function PendingRow({ p, free }: { p: { id: number; name: string; email: string; empNo: string }; free: { id: number; name: string }[] }) {
  const [role, setRole] = useState('');
  const [type, setType] = useState<WorkType>('hybrid');
  const [link, setLink] = useState('');
  const { run, pending } = useAction();
  return (
    <li className="pr" style={{ flexWrap: 'wrap' }}>
      <Avatar name={p.name} /><span className="pn"><b>{p.name}</b><small>{p.email} · {p.empNo}</small></span>
      <span className="pr-r" style={{ flexWrap: 'wrap' }}>
        <input type="text" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 160 }} aria-label="Role" />
        <select value={type} onChange={(e) => setType(e.target.value as WorkType)} aria-label="Work pattern">{(Object.keys(WORKTYPE) as WorkType[]).map((k) => <option key={k} value={k}>{WORKTYPE[k]}</option>)}</select>
        <button className="btn primary sm" disabled={pending} onClick={() => run(() => approvePending(p.id, role, type))}>Add to team</button>
        {free.length > 0 && (<>
          <select value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link to an existing name"><option value="">Link to existing…</option>{free.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <button className="btn sm" disabled={pending || !link} onClick={() => run(() => linkPending(p.id, +link))}>Link</button>
        </>)}
        <button className="btn sm" disabled={pending} onClick={() => run(() => removePending(p.id))}>Remove</button>
      </span><span />
    </li>
  );
}

export function Accounts({ people, meId, superadmin }: { people: P[]; meId: number; superadmin: boolean }) {
  const { run, pending } = useAction();
  const [temp, setTemp] = useState<{ name: string; pw: string } | null>(null);
  return (
    <section className="card" id="accounts"><div className="sec-h"><h3>Accounts</h3><span className="count">{people.length} signed up</span></div>
      <ul className="mini">{people.map((p) => (
        <li key={p.id}>
          <span><b>{p.name}</b> · <span className="muted">{p.email}</span> {(p.isHr || p.isSuperadmin) && <Chip c="info">{p.isSuperadmin ? 'Superadmin' : 'HR'}{p.totpOn ? ' · 2-step on' : ''}</Chip>}
            {p.lastSignIn && <small className="muted"> · last sign-in {new Date(p.lastSignIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>}</span>
          {(!(p.isHr || p.isSuperadmin) || superadmin) ? <span className="row gap">
            <button className="btn sm" disabled={pending} onClick={() => run(async () => { const r = await resetPassword(p.id); if (r.temp) setTemp({ name: p.name, pw: r.temp }); return r.error ? r : {}; })}>Reset password</button>
            {superadmin && p.isHr && p.totpOn && <button className="btn sm" disabled={pending} onClick={() => run(() => resetTotp(p.id))}>Reset 2-step</button>}
            {p.id !== meId && <button className="btn sm" disabled={pending} onClick={() => confirm(`Unlink ${p.name}’s login? Their records stay; they’ll create a new password.`) && run(() => unlinkAccount(p.id))}>Unlink</button>}
          </span> : <small className="muted">managed by a superadmin</small>}
        </li>
      ))}</ul>
      <p className="note">Everyone can see the Team pages. Only HR can see personal records and change settings. Only a superadmin can give or remove HR access, or reset an HR account. People not on this list haven’t created their password yet.</p>
      {temp && (
        <Modal title={`Temporary password for ${temp.name}`} onClose={() => setTemp(null)}>
          <p>Give this to {temp.name} privately. They’ll be asked to choose a new password when they sign in. It won’t be shown again.</p>
          <div className="temp-pw">{temp.pw}</div>
          <div className="row end"><button className="btn primary" onClick={() => setTemp(null)}>Done</button></div>
        </Modal>
      )}
    </section>
  );
}
