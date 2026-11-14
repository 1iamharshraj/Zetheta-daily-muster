'use client';
import { useState } from 'react';
import { Chip, useAction } from '@/components/ui';
import { excuseLate, markAbsenceLeave, spotCheck, correctDay, decideEdit, decideLeave } from '@/app/actions/hr';
import { MODES, MSHORT, TSTAT } from '@/lib/constants';
import { fmtShort, hmOf, hrs, tLabel } from '@/lib/time';
import type { DayInfo, DayRec } from '@/lib/rules';
import type { Mode } from '@/lib/db/schema';

export function DayDetail({ personId, type, k, i, rec, planned, hr }: { personId: number; type: string; k: string; i: DayInfo; rec: DayRec | null; planned: boolean; hr: boolean }) {
  const { run, pending } = useAction();
  const r = rec || ({ date: k } as DayRec);
  const [ci, setCi] = useState(hmOf(r.checkInAt));
  const [co, setCo] = useState(hmOf(r.checkOutAt));
  const [md, setMd] = useState<Mode>(r.mode || (type === 'remote' ? 'remote' : 'office'));
  const lv = r.leave && ['pending', 'approved'].includes(r.leave.status) ? r.leave : null;
  const plan = r.plan || [];
  const edit = r.edit as { status: string; reason?: string } | null | undefined;
  const lateish = r.lateStatus === 'late' || r.lateStatus === 'severe';
  const src = r.checkInAt && r.checkInSrc && r.checkInSrc !== 'server' ? (r.checkInSrc === 'hr' ? ['Corrected by HR', 'mute'] : ['Entered by employee', 'warn']) : null;
  return (
    <div className="dayrow">
      <div className="dr-h">
        <b>{fmtShort(k)}</b><span className={'chip ' + (i.cls || '')}>{i.label || '—'}</span>
        {r.checkInAt && <Chip c="mute">In {tLabel(r.checkInAt)}{r.checkOutAt ? ' · Out ' + tLabel(r.checkOutAt) : ''}</Chip>}
        {i.hours > 0 && <Chip c="mute">{hrs(i.hours)}</Chip>}
        {(i.severe || i.late) && <Chip c={i.severe ? 'bad' : 'warn'}>+{i.lateMins} min</Chip>}
        {i.excusedLate && <Chip c="info">Late excused</Chip>}
        {src && <Chip c={src[1]}>{src[0]}</Chip>}
        {r.spot === 'yes' && <Chip c="ok">Spot check: in office</Chip>}
        {r.spot === 'no' && <Chip c="bad">Spot check: not in office</Chip>}
        {lv && <Chip c={lv.status === 'pending' ? 'mute' : planned ? 'info' : 'bad'}>{lv.half ? 'Half-day ' : ''}{planned ? 'planned' : 'unplanned'} leave{lv.status === 'pending' ? ' · awaiting HR' : ''}</Chip>}
      </div>
      <div className="dr-b">
        {r.meetingNote && <div className="note">At: {r.meetingNote}</div>}
        {plan.length > 0 && <ul>{plan.map((x, j) => <li key={x.id}>{j + 1}. {x.text} <Chip c={TSTAT[x.status].c}>{TSTAT[x.status].l}</Chip></li>)}</ul>}
        {r.metrics && Object.keys(r.metrics).some((m) => +r.metrics![m]) && <div className="metricline">{Object.keys(r.metrics).filter((m) => +r.metrics![m]).map((m) => `${MSHORT[m] || m} ${r.metrics![m]}`).join(' · ')}</div>}
        {r.eod && <div className="quote">{r.eod}</div>}
        {r.blocker?.text && <div className="blocker"><b>Blocker{r.blocker.resolved ? ' (resolved)' : ''}:</b> {r.blocker.text}</div>}
        {lv?.reason && <div className="note">Leave reason: {lv.reason}</div>}
      </div>
      {hr && (<>
        <div className="admin">
          {edit?.status === 'pending' && (<>
            <span className="chip warn">Edited by employee: {edit.reason}</span>
            <button className="btn primary sm" disabled={pending} onClick={() => run(() => decideEdit(personId, k, true))}>Accept change</button>
            <button className="btn sm" disabled={pending} onClick={() => run(() => decideEdit(personId, k, false))}>Reject &amp; revert</button>
          </>)}
          {lv?.status === 'pending' && lv.id && (<>
            <button className="btn primary sm" disabled={pending} onClick={() => run(() => decideLeave([lv.id!], true))}>Approve leave</button>
            <button className="btn sm" disabled={pending} onClick={() => run(() => decideLeave([lv.id!], false))}>Reject leave</button>
          </>)}
          {r.checkInAt && lateish && <button className="btn sm" disabled={pending} onClick={() => run(() => excuseLate(personId, k, !r.lateExcused))}>{r.lateExcused ? 'Remove excuse' : 'Excuse late mark'}</button>}
          {i.absent > 0 && !r.spot && !r.checkInAt && (<>
            <button className="btn sm" disabled={pending} onClick={() => run(() => markAbsenceLeave(personId, k, true))}>Mark approved leave</button>
            <button className="btn sm" disabled={pending} onClick={() => run(() => markAbsenceLeave(personId, k, false))}>Mark unplanned leave</button>
          </>)}
          {r.checkInAt && r.mode === 'office' && !r.spot && (<>
            <button className="btn sm" disabled={pending} onClick={() => run(() => spotCheck(personId, k, 'yes'))}>Spot check: seen</button>
            <button className="btn sm" disabled={pending} onClick={() => run(() => spotCheck(personId, k, 'no'))}>Spot check: not in</button>
          </>)}
          {r.spot && <button className="btn sm" disabled={pending} onClick={() => run(() => spotCheck(personId, k, null))}>Clear spot check</button>}
        </div>
        <details><summary>Correct check-in / check-out time</summary>
          <div className="corr">
            <label>In<input type="time" value={ci} onChange={(e) => setCi(e.target.value)} /></label>
            <label>Out<input type="time" value={co} onChange={(e) => setCo(e.target.value)} /></label>
            <label>Mode<select value={md} onChange={(e) => setMd(e.target.value as Mode)}>
              {(Object.keys(MODES) as Mode[]).map((m) => <option key={m} value={m}>{MODES[m].label}</option>)}</select></label>
            <button className="btn sm" disabled={pending} onClick={() => run(() => correctDay(personId, k, md, ci, co))}>Save correction</button>
          </div>
        </details>
      </>)}
    </div>
  );
}
