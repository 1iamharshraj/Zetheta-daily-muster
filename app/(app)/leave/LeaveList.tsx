'use client';
import { Chip, useAction } from '@/components/ui';
import { cancelLeave } from '@/app/actions/day';
import { LKIND } from '@/lib/constants';
import { fmtShort } from '@/lib/time';
import type { LeaveKind, LeaveStatus } from '@/lib/db/schema';

type Row = { id: number; date: string; half: boolean; kind: LeaveKind; reason: string; status: LeaveStatus; hrComment: string | null; planned: boolean; cancellable: boolean };

const ST: Record<LeaveStatus, [string, string]> = { pending: ['Awaiting HR', 'mute'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'], cancelled: ['Cancelled', 'mute'] };

export function LeaveList({ rows }: { rows: Row[] }) {
  const { run } = useAction();
  return (
    <ul className="mini">
      {rows.map((r) => (
        <li key={r.id}>
          <span><b>{fmtShort(r.date)}</b> · {r.half ? 'Half day' : 'Full day'} · {LKIND[r.kind]}
            {r.reason && <span className="muted"> · {r.reason}</span>}
            {r.hrComment && <span className="muted"> · HR: {r.hrComment}</span>}
          </span>
          <span className="row gap">
            <Chip c={ST[r.status][1]}>{ST[r.status][0]}</Chip>
            {r.status !== 'rejected' && <Chip c={r.planned ? 'info' : 'bad'}>{r.planned ? 'Planned' : 'Unplanned'}</Chip>}
            {r.cancellable && <button className="link" onClick={() => run(() => cancelLeave(r.id))}>Cancel</button>}
          </span>
        </li>
      ))}
    </ul>
  );
}
