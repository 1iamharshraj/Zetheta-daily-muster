'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Modal, useAction } from './ui';
import { editDay, type EditInput } from '@/app/actions/day';
import { addD, addMonth, dow, fmtLong, fmtMonth, fmtShort, hmOf, hrs, monthOf, num, tLabel } from '@/lib/time';
import { MODES } from '@/lib/constants';
import type { MonthSummary, DayRec } from '@/lib/rules';
import type { Settings } from '@/lib/settings';
import { leaveHint } from './LeaveModal';

export const canEditDay = (today: string, k: string) => k >= addMonth(monthOf(today), -1) + '-01' && k <= addD(today, 90);

/** Month calendar + KPI strip + day log. Used by My attendance (editable) and person pages (read-only). */
export function AttendanceView({ ym, today, ms, s, type, editable, basePath, hideLog, hideStrip }: {
  ym: string; today: string; ms: MonthSummary; s: Settings; type: string; editable?: boolean; basePath: string; hideLog?: boolean; hideStrip?: boolean;
}) {
  const [edk, setEdk] = useState<string | null>(null);
  const lead = (dow(ym + '-01') + 6) % 7;
  const cur = monthOf(today);
  const logs = ms.cells.slice().reverse().filter((c) => c.rec && (c.rec.checkInAt || c.rec.leave));
  return (
    <>
      <div className="toolbar"><h2>{fmtMonth(ym)}</h2>
        <div className="row gap">
          <Link className="btn sm" href={`${basePath}?m=${addMonth(ym, -1)}`}>← Previous</Link>
          {ym === cur ? <button className="btn sm" disabled>This month</button> : <Link className="btn sm" href={basePath}>This month</Link>}
          {ym >= addMonth(cur, 2) ? <button className="btn sm" disabled>Next →</button> : <Link className="btn sm" href={`${basePath}?m=${addMonth(ym, 1)}`}>Next →</Link>}
        </div>
      </div>
      {!hideStrip && <div className="strip">
        <div className="ok"><b>{ms.office + ms.meeting}</b><span>Office &amp; events</span></div>
        <div><b>{ms.wfh + ms.remote}</b><span>Home / remote</span></div>
        <div className={ms.totalMarks ? 'warn' : ''}><b>{ms.totalMarks}</b><span>Late marks</span></div>
        <div className={ms.halfDays ? 'bad' : ''}><b>{ms.halfDays}</b><span>Half days cut</span></div>
        <div><b>{num(ms.leave)}</b><span>Leave taken</span></div>
        <div className={ms.absent ? 'bad' : ''}><b>{num(ms.absent)}</b><span>Absent</span></div>
      </div>}
      {editable && <p className="hint">Tap any day to change it: mark where you worked, plan days ahead, fill in a missed clock-in, or take leave. Changes to past days need a reason and are shown to HR.</p>}
      {type === 'part' && <p className="note">Late-mark and absence rules don’t apply to part-time work.</p>}
      <section className="card">
        <div className="calg">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="wd">{d}</div>)}
          {Array.from({ length: lead }, (_, j) => <div key={'b' + j} className="cd blank" />)}
          {ms.cells.map(({ k, i, rec }) => {
            const lt = i.late || i.severe, ok = !!editable && canEditDay(today, k);
            return (
              <button key={k} type="button" disabled={!ok}
                className={`cd ${i.mcls}${k === today ? ' today' : ''}${lt ? ' late' : ''}${ok ? ' ed' : ''}${i.leavePending ? ' lvpend' : ''}`}
                onClick={() => ok && setEdk(k)}
                title={fmtShort(k) + (i.label ? ' · ' + i.label : '') + (i.leavePending ? ' · awaiting HR' : '') + (ok ? ' · tap to edit' : '')}>
                <span className="dn">{+k.slice(8)}{(i.edited || i.manual) && <> <span className="pen" title="Edited">✎</span></>}</span>
                <span className="cl">{(i.label || '').replace('Meeting / Event', 'Event')}</span>
                {rec?.checkInAt && <span className="ct">{hmOf(rec.checkInAt)}{lt ? ` · +${i.lateMins}m` : ''}</span>}
                {ok && !i.label && <span className="addh">+ Add</span>}
              </button>
            );
          })}
        </div>
        <div className="legend">
          {[['m-office', 'Office'], ['m-wfh', 'WFH'], ['m-remote', 'Remote'], ['m-meeting', 'Event'], ['m-leave', 'Leave'], ['m-absent', 'Absent'], ['m-hol', 'Holiday'], ['m-game', 'Gamesday']].map(([c, l]) => <span key={c} className={'lg ' + c}>{l}</span>)}
          <span>Red edge = late mark · ✎ = edited · dashed = planned or awaiting HR</span>
        </div>
      </section>
      {!hideLog && <section className="card">
        <div className="sec-h"><h3>Day log</h3><span className="count">{ms.hoursDays ? 'avg ' + (ms.hours / ms.hoursDays).toFixed(1) + ' h/day' : ''}</span></div>
        {logs.length ? (
          <div className="tbl" style={{ border: 0 }}><table>
            <thead><tr><th className="nm">Date</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th>Tasks</th></tr></thead>
            <tbody>{logs.map(({ k, i, rec }) => (
              <tr key={k} className={editable && canEditDay(today, k) ? 'clickable' : ''} onClick={() => editable && canEditDay(today, k) && setEdk(k)}>
                <td className="nm">{fmtShort(k)}{(i.edited || i.manual) && ' ✎'}</td>
                <td><span className={'chip ' + i.cls}>{i.label || '—'}{i.leavePending ? ' · awaiting HR' : ''}</span></td>
                <td>{tLabel(rec?.checkInAt)}</td><td>{tLabel(rec?.checkOutAt)}</td>
                <td>{i.hours ? hrs(i.hours) : '—'}</td><td>{i.tasks[1] ? `${i.tasks[0]}/${i.tasks[1]}` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="note">Nothing recorded this month yet.</p>}
      </section>}
      {edk && <DayEditor k={edk} rec={ms.cells.find((c) => c.k === edk)?.rec} today={today} s={s} type={type} onClose={() => setEdk(null)} />}
    </>
  );
}

const EDL: Record<string, string> = { office: 'Office', wfh: 'Work from home', remote: 'Remote', meeting: 'Meeting / Event', half: 'Half day', leave: 'Leave', none: 'Clear this day' };
function curStatus(rec?: DayRec) {
  if (!rec) return '';
  const lv = rec.leave && ['pending', 'approved'].includes(rec.leave.status) ? rec.leave : null;
  if (lv && !lv.half) return 'leave';
  if (lv && lv.half) return 'half';
  if (rec.checkInAt) return rec.mode && MODES[rec.mode] ? rec.mode : 'office';
  return rec.intent || '';
}

function DayEditor({ k, rec, today, s, type, onClose }: { k: string; rec?: DayRec; today: string; s: Settings; type: string; onClose: () => void }) {
  const fut = k > today, isT = k === today;
  const srvIn = !!(rec?.checkInAt && rec.checkInSrc === 'server');
  const srvOut = !!(rec?.checkOutAt && rec.checkOutSrc === 'server');
  const [v, setV] = useState<EditInput>({
    k, st: curStatus(rec), ci: hmOf(rec?.checkInAt), co: hmOf(rec?.checkOutAt),
    note: rec?.meetingNote || '', reason: rec?.leave?.reason || '', sum: rec?.eod || '', kind: rec?.leave?.kind || 'casual',
  });
  const set = (p: Partial<EditInput>) => setV((o) => ({ ...o, ...p }));
  const { run, pending } = useAction();
  const opts = [...(type === 'remote' ? ['remote', 'meeting'] : ['office', 'wfh', 'meeting']), 'half', 'leave'];
  if (curStatus(rec) && !srvIn) opts.push('none');
  const st = v.st, work = ['office', 'wfh', 'remote', 'meeting'].includes(st);
  const liveNow = isT && !rec?.checkInAt && (work || st === 'half');
  const kindSel = (
    <label className="fl">Leave from<select value={v.kind} onChange={(e) => set({ kind: e.target.value as EditInput['kind'] })}>
      <option value="casual">Casual leave</option><option value="earned">Earned leave</option><option value="lwp">Leave without pay</option></select></label>
  );
  let body: React.ReactNode;
  if (!st) body = <p className="hint">Pick what this day was (or will be).</p>;
  else if (st === 'none') body = <p className="hint">{fut ? 'Removes your plan or leave for this day.' : 'Removes the manual entry for this day.'}</p>;
  else if (fut) {
    body = work ? (<>
      <p className="hint">Saved as your plan. On the day you still clock in from Home; it will start on “{MODES[st as keyof typeof MODES].label}”.</p>
      {st === 'meeting' && <label className="fl">Where and with whom?<input type="text" maxLength={120} value={v.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Demo at KJSIM" /></label>}
    </>) : (<>
      {kindSel}
      <label className="fl">Reason <span className="muted">(optional)</span><input type="text" maxLength={120} value={v.reason} onChange={(e) => set({ reason: e.target.value })} /></label>
      <p className="hint">{leaveHint(s, today, k)}</p>
    </>);
  } else if (liveNow) {
    body = <><p className="hint">Today is recorded live: use Clock in on Home. You can still mark today as leave here.</p><Link className="btn primary" href="/home" onClick={onClose}>Go to Clock in</Link></>;
  } else if (st === 'leave') {
    body = srvIn ? <p className="hint">You clocked in this day, so it can’t be a full-day leave. Pick Half day instead.</p> : (<>
      {kindSel}
      <label className="fl">Reason<input type="text" maxLength={160} value={v.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Unwell" /></label>
      <p className="hint">Leave added on or after the day counts as unplanned. HR approves it.</p>
    </>);
  } else {
    body = (<>
      <div className="form">
        {srvIn ? <div className="fl">Started<div className="locked"><input type="text" value={tLabel(rec!.checkInAt)} readOnly /><span className="chip mute">by Clock in</span></div></div>
          : <label className="fl">Started at<input type="time" value={v.ci} onChange={(e) => set({ ci: e.target.value })} /></label>}
        {srvOut ? <div className="fl">Finished<div className="locked"><input type="text" value={tLabel(rec!.checkOutAt)} readOnly /><span className="chip mute">by Clock out</span></div></div>
          : <label className="fl">Finished at<input type="time" value={v.co} onChange={(e) => set({ co: e.target.value })} /></label>}
      </div>
      {srvIn && <p className="hint">Times from Clock in / Clock out can only be corrected by HR.</p>}
      {st === 'meeting' && <label className="fl">Where and with whom?<input type="text" maxLength={120} value={v.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Demo at KJSIM with the TPO" /></label>}
      {st === 'half' && kindSel}
      <label className="fl">What did you do that day?<textarea rows={3} maxLength={1200} value={v.sum} onChange={(e) => set({ sum: e.target.value })} placeholder="Two or three lines" /></label>
      <label className="fl">Reason for the change<input type="text" maxLength={160} value={v.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Forgot to clock in; was at a college visit" /></label>
    </>);
  }
  const canSave = !!st && !liveNow && !(st === 'leave' && srvIn && !fut);
  return (
    <Modal title={fmtLong(k)} onClose={onClose}>
      <p className="muted">{fut ? 'Planning ahead' : isT ? 'Today' : 'Past day'} · now: <b>{EDL[curStatus(rec)] || 'No entry'}</b>{rec?.leave?.status === 'pending' ? ' (awaiting HR)' : ''}</p>
      <div className="edopts" role="radiogroup" aria-label="Status">
        {opts.map((o) => <button key={o} type="button" role="radio" aria-checked={o === st} className={`mode ${o === st ? 'on' : ''} ${o === 'none' ? 'clr' : ''}`} onClick={() => set({ st: o })}>{EDL[o]}</button>)}
      </div>
      {body}
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancel</button>
        {canSave && <button className="btn primary" disabled={pending} onClick={() => run(() => editDay(v), onClose)}>Save</button>}
      </div>
    </Modal>
  );
}
