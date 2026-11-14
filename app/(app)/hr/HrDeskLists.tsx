'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Chip, useAction } from '@/components/ui';
import { decideLeave, decideEdit, markAbsenceLeave } from '@/app/actions/hr';
import { fmtShort } from '@/lib/time';

export type LeaveReq = { ids: number[]; personId: number; name: string; photo: string | null; from: string; to: string; n: number; half: boolean; kind: string; reason: string; planned: boolean };
export type Absence = { personId: number; name: string; photo: string | null; k: string; kind: 'absent' | 'unplanned'; label: string };
export type EditRow = { personId: number; name: string; photo: string | null; k: string; reason: string };
type Up = { id: number; personId: number; name: string; photo: string | null; k: string; half: boolean; kind: string; reason: string; planned: boolean };

function Request({ r }: { r: LeaveReq }) {
  const [c, setC] = useState('');
  const { run, pending } = useAction();
  return (
    <li className="pr" style={{ flexWrap: 'wrap' }}>
      <Avatar name={r.name} photo={r.photo} size="sm" />
      <span className="pn"><b>{r.name}</b>
        <small>{fmtShort(r.from)}{r.n > 1 ? ` – ${fmtShort(r.to)} · ${r.n} working days` : ''} · {r.half ? 'Half day' : 'Full day'} · {r.kind}{r.reason ? ' · ' + r.reason : ''}</small></span>
      <span className="pr-r">
        <Chip c={r.planned ? 'info' : 'bad'}>{r.planned ? 'Planned' : 'Unplanned'}</Chip>
        <input type="text" maxLength={300} placeholder="Comment (optional)" value={c} onChange={(e) => setC(e.target.value)} style={{ maxWidth: 180 }} aria-label="Comment for the employee" />
        <button className="btn primary sm" disabled={pending} onClick={() => run(() => decideLeave(r.ids, true, c))}>Approve</button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => decideLeave(r.ids, false, c))}>Reject</button>
      </span><span />
    </li>
  );
}

export function HrDeskLists({ requests, absences, edits, upcoming }: { requests: LeaveReq[]; absences: Absence[]; edits: EditRow[]; upcoming: Up[] }) {
  const { run, pending } = useAction();
  const [allAbs, setAllAbs] = useState(false);
  return (
    <>
      <section className="card" id="requests"><div className="sec-h"><h3>Leave requests</h3><span className="count">{requests.length ? `${requests.length} waiting` : 'all decided'}</span></div>
        {requests.length ? <ul className="pulse">{requests.map((r) => <Request key={r.ids.join(',')} r={r} />)}</ul> : <p className="hint">No leave waiting for a decision.</p>}
      </section>
      {edits.length > 0 && (
        <section className="card"><div className="sec-h"><h3>Attendance edits to review</h3><span className="count">reject restores what was there before</span></div>
          <ul className="pulse">{edits.map((x) => (
            <li key={x.personId + x.k} className="pr"><Avatar name={x.name} photo={x.photo} size="sm" />
              <span className="pn"><b>{x.name}</b><small>{fmtShort(x.k)} · {x.reason}</small></span>
              <span className="pr-r">
                <button className="btn primary sm" disabled={pending} onClick={() => run(() => decideEdit(x.personId, x.k, true))}>Accept</button>
                <button className="btn sm" disabled={pending} onClick={() => run(() => decideEdit(x.personId, x.k, false))}>Reject</button>
                <Link className="btn sm" href={`/team/${x.personId}?m=${x.k.slice(0, 7)}`}>Open</Link>
              </span><span />
            </li>
          ))}</ul>
        </section>
      )}
      <div className="two" style={{ alignItems: 'start' }}>
        <section className="card"><div className="sec-h"><h3>Upcoming leave</h3><span className="count">approved · next 60 days</span></div>
          {upcoming.length ? <ul className="pulse">{upcoming.map((x) => (
            <li key={x.id} className="pr"><Avatar name={x.name} photo={x.photo} size="sm" />
              <span className="pn"><b>{x.name}</b><small>{fmtShort(x.k)} · {x.half ? 'Half day' : 'Full day'} · {x.kind}{x.reason ? ' · ' + x.reason : ''}</small></span>
              <span className="pr-r"><Chip c={x.planned ? 'info' : 'bad'}>{x.planned ? 'Planned' : 'Unplanned'}</Chip></span><span />
            </li>
          ))}</ul> : <p className="hint">No approved leave in the next 60 days.</p>}
        </section>
        <section className="card"><div className="sec-h"><h3>Unplanned leave &amp; absences</h3><span className="count">last 30 days</span></div>
          {absences.length ? (<>
            <ul className="pulse">{(allAbs ? absences : absences.slice(0, 10)).map((x) => (
              <li key={x.personId + x.k} className="pr"><Avatar name={x.name} photo={x.photo} size="sm" />
                <span className="pn"><b>{x.name}</b><small>{fmtShort(x.k)} · {x.label}</small></span>
                <span className="pr-r">
                  <Chip c="bad">{x.kind === 'absent' ? 'Absent' : 'Unplanned'}</Chip>
                  {x.kind === 'absent' && <button className="btn sm" disabled={pending} onClick={() => run(() => markAbsenceLeave(x.personId, x.k, true))}>Mark approved leave</button>}
                </span><span />
              </li>
            ))}</ul>
            {absences.length > 10 && !allAbs && <button className="btn sm" onClick={() => setAllAbs(true)}>Show all {absences.length}</button>}
          </>) : <p className="hint">Nothing unplanned in the last 30 days.</p>}
        </section>
      </div>
    </>
  );
}
