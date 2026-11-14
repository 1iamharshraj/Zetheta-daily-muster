'use client';
import { useState } from 'react';
import { useAction } from '@/components/ui';
import { setSenior } from '@/app/actions/week';
import { SENIOR } from '@/lib/constants';
import type { SeniorStatus } from '@/lib/db/schema';

export function FeedbackBox({ personId, name, w, status, comment }: { personId: number; name: string; w: string; status: SeniorStatus | null; comment: string }) {
  const [c, setC] = useState(comment);
  const { run, pending } = useAction();
  return (
    <>
      <div className="row gap wrap">{(Object.keys(SENIOR) as SeniorStatus[]).map((k) => (
        <button key={k} className={'btn sm ' + (status === k ? 'on' : '')} aria-pressed={status === k} disabled={pending}
          onClick={() => run(() => setSenior(personId, w, status === k ? null : k))}>{SENIOR[k].l}</button>
      ))}</div>
      <textarea rows={2} maxLength={1200} placeholder={`Feedback for ${name} (they see this)`} value={c} onChange={(e) => setC(e.target.value)} />
      <div className="row end"><button className="btn primary sm" disabled={pending} onClick={() => run(() => setSenior(personId, w, undefined, c))}>Send feedback</button></div>
    </>
  );
}
