'use client';
import { useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, PBar, useAction } from './ui';
import { saveProfile, saveRecord, setPhoto } from '@/app/actions/profile';
import { ADDR_FIELDS, JOB_FIELDS, profilePct, type Personal } from '@/lib/profile';
import { GENDERS, RELATIONS, STATES } from '@/lib/constants';
import { dmy } from '@/lib/time';

const REQ = <i className="req" aria-label="required">*</i>;
const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  let o = d.slice(0, 2);
  if (d.length > 2) o += '-' + d.slice(2, 4);
  if (d.length > 4) o += '-' + d.slice(4);
  return o;
};

function Frozen({ l, v, cls, tip }: { l: string; v: string; cls?: string; tip?: string }) {
  return (
    <div className={'fl ' + (cls || '')}><span>{l}</span>
      <div className="rov" title={tip || 'Set automatically. Can’t be edited.'}><span>{v || '—'}</span><Icon n="lock" c="lk" /></div>
    </div>
  );
}

/** Resize any image to a 192 px square JPEG under ~60 KB (PRF-7). */
async function photoToData(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const sz = Math.min(img.naturalWidth, img.naturalHeight);
    if (!sz) throw new Error('empty');
    const N = 192, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const cx = cv.getContext('2d')!;
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, N, N);
    cx.drawImage(img, (img.naturalWidth - sz) / 2, (img.naturalHeight - sz) / 2, sz, sz, 0, 0, N, N);
    let q = 0.85, d = cv.toDataURL('image/jpeg', q);
    while (d.length > 60000 && q > 0.4) { q -= 0.15; d = cv.toDataURL('image/jpeg', q); }
    return d;
  } finally { URL.revokeObjectURL(url); }
}

export type ProfileProps = {
  mode: 'self' | 'hr'; personId: number; empNo: string; email: string; fullName: string; photo: string | null;
  personal: Personal; job: Record<string, string>;
};

export function ProfileForm(props: ProfileProps) {
  const { mode, personId, empNo } = props;
  const hr = mode === 'hr';
  const [name, setName] = useState(props.fullName);
  const [p, setP] = useState<Personal>(() => {
    const x: Personal = { primaryEmail: props.email, ...props.personal };
    x.dob = dmy(String(x.dob || ''));
    for (const pf of ['perm', 'present']) if (!x[pf + 'Country']) x[pf + 'Country'] = 'India';
    return x;
  });
  const [job, setJob] = useState<Record<string, string>>(() => Object.fromEntries(JOB_FIELDS.map((f) => [f.k, f.type === 'date' ? dmy(props.job[f.k]) : props.job[f.k] || ''])));
  const [ec2, setEc2] = useState(!!(p.em2Name || p.em2Phone || p.em2Rel));
  const [saved, setSaved] = useState<Personal>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending, toast } = useAction();
  const g = (k: string) => String(p[k] ?? '');
  const same = !!p.presentSame;

  const set = (k: string, v: string | boolean) => setP((o) => {
    const n: Personal = { ...o, [k]: v };
    if (n.presentSame && k.startsWith('perm')) n['present' + k.slice(4)] = v; // keep in sync live (PRF-5)
    return n;
  });
  const toggleSame = (on: boolean) => setP((o) => {
    const n: Personal = { ...o, presentSame: on };
    if (on) { const keep: Personal = {}; ADDR_FIELDS.forEach((f) => { keep[f.k] = o['present' + f.k]; n['present' + f.k] = o['perm' + f.k]; }); setSaved(keep); }
    else ADDR_FIELDS.forEach((f) => { if (saved[f.k] !== undefined) n['present' + f.k] = saved[f.k]; });
    return n;
  });
  const pct = useMemo(() => profilePct(p, !!props.photo, name), [p, props.photo, name]);

  const field = (k: string, l: string, opt: { cls?: string; type?: string; req?: boolean; opts?: string[]; ro?: boolean; hint?: string } = {}) => {
    const req = opt.req && !hr ? REQ : null;
    const lab = <span>{l}{opt.hint && <> <small className="muted">{opt.hint}</small></>}{req}</span>;
    if (opt.opts) {
      return (
        <label className={'fl ' + (opt.cls || '')} key={k}>{lab}
          <select value={g(k)} disabled={opt.ro} title={opt.ro ? 'Copied from permanent address' : undefined} onChange={(e) => set(k, e.target.value)}>
            <option value="">Select…</option>{opt.opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    }
    const t = opt.type || 'text';
    return (
      <label className={'fl ' + (opt.cls || '')} key={k}>{lab}
        <input type={t === 'pin' || t === 'date' ? 'text' : t} value={g(k)} readOnly={opt.ro} title={opt.ro ? 'Copied from permanent address' : undefined}
          inputMode={t === 'pin' || t === 'date' ? 'numeric' : undefined} maxLength={t === 'pin' ? 6 : t === 'date' ? 10 : 120}
          placeholder={t === 'pin' ? '6 digits' : t === 'date' ? 'dd-mm-yyyy' : undefined} autoComplete={t === 'pin' ? 'postal-code' : 'off'}
          onChange={(e) => set(k, t === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 6) : t === 'date' ? maskDate(e.target.value) : e.target.value)} />
      </label>
    );
  };
  const CLS: Record<string, string> = { Pin: 't1', Country: 't1' };
  const addr = (pf: 'perm' | 'present', lock: boolean) => (
    <div className="form form6">{ADDR_FIELDS.map((f) => field(pf + f.k, f.l, {
      cls: CLS[f.k] || 't2', type: f.type, req: f.req, opts: f.type === 'select' ? STATES : undefined, ro: lock, hint: f.hint,
    }))}</div>
  );

  const save = () => {
    if (hr) run(() => saveRecord(personId, name, p, job));
    else run(() => saveProfile(name, p));
  };
  const onPhoto = async (f?: File) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('Choose an image file (JPG or PNG).'); return; }
    if (f.size > 15e6) { toast('That image is too large. Pick one under 15 MB.'); return; }
    try { const d = await photoToData(f); run(() => setPhoto(d, hr ? personId : undefined)); } catch { toast('Couldn’t read that image. Try a JPG or PNG.'); }
  };

  return (
    <>
      <section className="card pcomp">
        <div className="pc-ph"><Avatar name={name} photo={props.photo} size="xl" />
          <div className="pc-btns">
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}><Icon n="camera" /> {props.photo ? 'Change photo' : 'Upload photo'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            {props.photo && <button type="button" className="btn sm" onClick={() => run(() => setPhoto(null, hr ? personId : undefined))}>Remove</button>}
          </div>
        </div>
        <div className="pc-main">
          <div className="pc-top"><b>Profile {pct.pct}% complete</b><span className="muted">{pct.done} of {pct.total} done</span></div>
          <PBar pct={pct.pct} cls="lgbar" />
          {pct.pct === 100 && <p className="pc-done"><Icon n="check" /> All done. Keep it up to date if anything changes.</p>}
          {hr && pct.missing.length > 0 && <p className="note">Missing: {pct.missing.join(', ')}</p>}
          <p className="note">The law requires Zetheta to keep a register of employees. Only {hr ? 'the employee' : 'you'} and HR can see these details.</p>
        </div>
      </section>

      {hr && (
        <section className="card"><div className="sec-h"><h3>Employment details</h3><span className="count">HR fills these</span></div>
          <div className="form">{JOB_FIELDS.map((f) => (
            <label className="fl" key={f.k}><span>{f.l}</span>
              {f.type === 'select' ? (
                <select value={job[f.k]} onChange={(e) => setJob({ ...job, [f.k]: e.target.value })}><option value="">Select…</option>{f.opts!.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'} min={0} value={job[f.k]} inputMode={f.type === 'date' ? 'numeric' : undefined}
                  placeholder={f.type === 'date' ? 'dd-mm-yyyy' : undefined} maxLength={f.type === 'date' ? 10 : 120}
                  onChange={(e) => setJob({ ...job, [f.k]: f.type === 'date' ? maskDate(e.target.value) : e.target.value })} />
              )}
            </label>
          ))}</div>
        </section>
      )}

      <section className="card"><div className="sec-h"><h3>Personal details</h3><span className="count">{hr ? 'usually filled by the employee' : 'you fill these'}</span></div>
        <div className="form form6">
          <label className="fl t4"><span>Full name (as in your documents){!hr && REQ}</span><input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <Frozen l="Employee code" v={empNo} cls="t2" tip="Given automatically at first sign-in. Can’t be edited." />
          {field('gender', 'Gender', { cls: 't2', req: true, opts: GENDERS })}
          {field('dob', 'Date of birth', { cls: 't2', req: true, type: 'date' })}
          {field('qualification', 'Highest qualification', { cls: 't2' })}
          {field('mobile', 'Mobile number (also used for WhatsApp)', { cls: 't2', req: true, type: 'tel' })}
          {field('primaryEmail', 'Primary email', { cls: 't2', req: true, type: 'email' })}
          {field('secondaryEmail', 'Secondary email', { cls: 't2', type: 'email' })}
        </div>
        <h4 className="adh">Permanent address{!hr && REQ}</h4>
        {addr('perm', false)}
        <div className="lblrow adh"><h4>Present address{!hr && REQ}</h4>
          <label className="chk"><input type="checkbox" checked={same} onChange={(e) => toggleSame(e.target.checked)} /> Same as permanent address</label></div>
        {addr('present', same)}
        <h4 className="ech">In case of emergency</h4>
        <div className="form form6">
          {field('emName', 'Name', { cls: 't2' })}{field('emRel', 'Relationship', { cls: 't2', opts: RELATIONS })}{field('emPhone', 'Contact number', { cls: 't2', type: 'tel' })}
        </div>
        {ec2 ? (
          <div className="ec2">
            <div className="sec-h ec2h"><span className="count">Second contact (optional)</span>
              <button type="button" className="btn sm" onClick={() => { setEc2(false); setP((o) => ({ ...o, em2Name: '', em2Rel: '', em2Phone: '' })); }}><Icon n="x" /> Remove</button></div>
            <div className="form form6">{field('em2Name', 'Name', { cls: 't2' })}{field('em2Rel', 'Relationship', { cls: 't2', opts: RELATIONS })}{field('em2Phone', 'Contact number', { cls: 't2', type: 'tel' })}</div>
          </div>
        ) : <button type="button" className="btn sm addec2" onClick={() => setEc2(true)}><Icon n="plus" /> Add another emergency contact</button>}
        <p className="note">Don’t enter Aadhaar, PAN or bank account numbers here. Give those to HR directly.</p>
        <div className="row end"><button className="btn primary" disabled={pending} onClick={save}>{pending ? 'Saving…' : hr ? 'Save record' : 'Save profile'}</button></div>
      </section>

      {!hr && (
        <section className="card"><div className="sec-h"><h3>Employment details</h3><span className="count">filled by HR</span></div>
          <div className="form">{JOB_FIELDS.filter((f) => f.k !== 'openingEL').map((f) => (
            <Frozen key={f.k} l={f.l} tip="Filled by HR. You can’t edit this."
              v={f.type === 'date' ? dmy(props.job[f.k]) : f.k === 'wageMonthly' && props.job[f.k] ? '₹ ' + Number(props.job[f.k]).toLocaleString('en-IN') : props.job[f.k] || ''} />
          ))}</div>
          <p className="note">Something wrong here? Tell HR.</p>
        </section>
      )}
    </>
  );
}
