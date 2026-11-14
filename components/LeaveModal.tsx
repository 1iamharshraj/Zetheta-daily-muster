'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, useAction } from './ui';
import { applyLeave } from '@/app/actions/day';
import { addD, fmtShort } from '@/lib/time';
import { isWorkday } from '@/lib/rules';
import type { Settings } from '@/lib/settings';

export function leaveHint(s: Settings, today: string, k: string) {
  if (!k) return 'Pick a date.';
  if (k < today) return 'Pick today or a later date.';
  if (!isWorkday(s, k)) return `${fmtShort(k)} isn’t a working day, so no leave is needed.`;
  if (k === today) return 'Same-day leave counts as unplanned and is flagged to HR.';
  return `${fmtShort(k)} will count as planned leave. HR approves every request.`;
}

export function LeaveModal({ s, today, onClose, goToLeave }: { s: Settings; today: string; onClose: () => void; goToLeave?: boolean }) {
  const nx = addD(today, 1);
  const [from, setFrom] = useState(nx);
  const [to, setTo] = useState(nx);
  const [half, setHalf] = useState(false);
  const [kind, setKind] = useState<'casual' | 'earned' | 'lwp'>('casual');
  const [reason, setReason] = useState('');
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <Modal title="Apply leave" onClose={onClose}>
      <div className="form">
        <label>From<input type="date" min={today} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value || half) setTo(e.target.value); }} /></label>
        <label>To<input type="date" min={from || today} value={half ? from : to} disabled={half} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Type<select value={half ? 'half' : 'full'} onChange={(e) => { setHalf(e.target.value === 'half'); setTo(from); }}>
          <option value="full">Full day(s)</option><option value="half">Half day (single date)</option></select></label>
        <label>Leave from<select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="casual">Casual leave</option><option value="earned">Earned leave</option><option value="lwp">Leave without pay</option></select></label>
        <label className="wide">Reason<input type="text" maxLength={120} placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <p className="note" aria-live="polite">{leaveHint(s, today, from)}</p>
      <div className="row end gap">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={pending} onClick={() => run(() => applyLeave({ from, to: half ? from : to, half, kind, reason }), () => { onClose(); if (goToLeave) router.push('/leave'); })}>
          {pending ? 'Applying…' : 'Apply leave'}
        </button>
      </div>
    </Modal>
  );
}

/** A primary "Apply leave" button that owns its modal. */
export function ApplyLeaveButton({ s, today, cls = 'btn primary sm', label = 'Apply leave', goToLeave }: { s: Settings; today: string; cls?: string; label?: string; goToLeave?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={cls} onClick={() => setOpen(true)}>{label}</button>
      {open && <LeaveModal s={s} today={today} onClose={() => setOpen(false)} goToLeave={goToLeave} />}
    </>
  );
}
