'use client';
import { useState } from 'react';
import { Chip, useAction } from './ui';
import { assignTask, withdrawTask } from '@/app/actions/hr';
import { TSTAT } from '@/lib/constants';
import { addD, fmtShort } from '@/lib/time';
import type { TaskStatus } from '@/lib/db/schema';

/** HR/superadmin: assign a task to one person (fixed) or pick several. */
export function AssignTask({ people, today, fixed }: { people: { id: number; name: string }[]; today: string; fixed?: { id: number; name: string } }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(today);
  const [sel, setSel] = useState<number[]>(fixed ? [fixed.id] : []);
  const { run, pending } = useAction();
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submit = () => run(() => assignTask(sel, date, text), () => { setText(''); if (!fixed) setSel([]); });
  return (
    <section className="card" id="assign">
      <div className="sec-h"><h3>Assign a task{fixed ? ` to ${fixed.name}` : ''}</h3><span className="count">shows on their task list</span></div>
      <div className="form">
        <label className="wide">Task<input type="text" maxLength={200} value={text} placeholder="e.g. Send the MoU draft to Axis Capital"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /></label>
        <label>For<input type="date" min={today} max={addD(today, 90)} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {!fixed && (
        <div className="mets" role="group" aria-label="Assign to">
          <label style={{ fontWeight: 600 }}><input type="checkbox" checked={sel.length === people.length && people.length > 0} onChange={(e) => setSel(e.target.checked ? people.map((p) => p.id) : [])} />Everyone</label>
          {people.map((p) => <label key={p.id}><input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}</label>)}
        </div>
      )}
      <div className="row end gap">
        <span className="note">{date === today ? 'For today.' : `For ${fmtShort(date)}.`} They’re notified; they update its status but can’t delete it.</span>
        <button className="btn primary" disabled={pending || !text.trim() || !sel.length} onClick={submit}>Assign{sel.length > 1 ? ` to ${sel.length}` : ''}</button>
      </div>
    </section>
  );
}

export type AssignedRow = { personId: number; name: string; date: string; id: string; text: string; status: TaskStatus; by: string };

/** Tracker of tasks HR assigned, with live status from the employee. */
export function AssignedList({ rows, today, title = 'Assigned tasks', showName = true }: { rows: AssignedRow[]; today: string; title?: string; showName?: boolean }) {
  const { run, pending } = useAction();
  const [all, setAll] = useState(false);
  const open = rows.filter((r) => r.status !== 'done');
  const shown = all ? rows : open;
  return (
    <section className="card"><div className="sec-h"><h3>{title}</h3>
      <span className="row gap"><span className="count">{open.length} open · {rows.length - open.length} done</span>
        {rows.length !== open.length && <button className="btn sm" onClick={() => setAll(!all)}>{all ? 'Open only' : 'Show done'}</button>}</span></div>
      {shown.length ? (
        <ul className="mini">{shown.map((r) => (
          <li key={r.personId + r.date + r.id}>
            <span>{showName && <b>{r.name} · </b>}{r.text} <span className="muted">· {r.date === today ? 'today' : fmtShort(r.date)} · from {r.by}</span>
              {r.date < today && r.status !== 'done' && <> <Chip c="warn">overdue</Chip></>}</span>
            <span className="row gap"><Chip c={TSTAT[r.status].c}>{TSTAT[r.status].l}</Chip>
              {r.status !== 'done' && <button className="link" disabled={pending} onClick={() => run(() => withdrawTask(r.personId, r.date, r.id))}>Withdraw</button>}</span>
          </li>
        ))}</ul>
      ) : <p className="hint">{rows.length ? 'Everything assigned is done.' : 'No tasks assigned yet.'}</p>}
    </section>
  );
}
