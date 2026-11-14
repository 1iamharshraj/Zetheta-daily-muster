'use client';
import { useState } from 'react';
import { useAction } from '@/components/ui';
import { saveCompliance } from '@/app/actions/settings';
import { dmy } from '@/lib/time';

export type CState = { st?: 'todo' | 'doing' | 'done' | 'na'; date?: string; note?: string };
const cls = (st: string) => (st === 'done' ? 'done' : st === 'doing' ? 'doing' : st === 'na' ? 'todo' : 'hold');
const mask = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); let o = d.slice(0, 2); if (d.length > 2) o += '-' + d.slice(2, 4); if (d.length > 4) o += '-' + d.slice(4); return o; };

export function ComplianceItem({ k, c, part }: { k: string; c: CState; part: 'status' | 'foot' }) {
  const { run } = useAction();
  const [st, setSt] = useState(c.st || 'todo');
  const [date, setDate] = useState(dmy(c.date));
  const [note, setNote] = useState(c.note || '');
  if (part === 'status') {
    return (
      <select className={'stsel s-' + cls(st)} aria-label="Status" value={st} onChange={(e) => { const v = e.target.value as CState['st']; setSt(v!); run(() => saveCompliance(k, { st: v })); }}>
        <option value="todo">Not started</option><option value="doing">In progress</option><option value="done">Done</option><option value="na">Not applicable</option>
      </select>
    );
  }
  return (
    <div className="row gap wrap cfoot">
      <label className="fl" style={{ flex: '0 0 170px' }}>Done on / next due
        <input type="text" inputMode="numeric" placeholder="dd-mm-yyyy" maxLength={10} value={date} onChange={(e) => setDate(mask(e.target.value))}
          onBlur={() => date !== dmy(c.date) && run(() => saveCompliance(k, { date }))} /></label>
      <label className="fl" style={{ flex: '1 1 220px' }}>Note
        <input type="text" maxLength={160} value={note} placeholder="e.g. reference number, who handles it" onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (c.note || '') && run(() => saveCompliance(k, { note }))} /></label>
    </div>
  );
}
