'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Modal } from './ui';
import { markGuideSeen } from '@/app/actions/auth';
import { m2label, hm2m } from '@/lib/time';
import type { Settings } from '@/lib/settings';

export const openGuide = () => window.dispatchEvent(new Event('muster:guide'));

/** HOME-13: first-time guide. Opens automatically once, and from the Help button. */
export function Guide({ autoOpen, s, hr, remote }: { autoOpen: boolean; s: Settings; hr: boolean; remote: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (autoOpen) setTimeout(() => setOpen(true), 500);
    const f = () => setOpen(true);
    window.addEventListener('muster:guide', f);
    return () => window.removeEventListener('muster:guide', f);
  }, [autoOpen]);
  if (!open) return null;
  const close = () => { setOpen(false); if (autoOpen) markGuideSeen(); };
  const ge = hm2m(s.officeStart) + +s.graceMin;
  return (
    <Modal title="How the muster works" onClose={close}>
      <p className="muted">It takes under two minutes a day.</p>
      {hr && (<>
        <h3>HR pages</h3><ul>
          <li><b>HR desk</b>: leave requests to approve, unplanned leave and absences, attendance edits to accept, leave balances, and an HR to-do list.</li>
          <li><b>Employee records</b>: the register of employees; add employment details and appointment-letter dates.</li>
          <li><b>Attendance sheet</b> and <b>Compliance</b>: monthly registers to download, and the statutory checklist.</li>
          <li><b>On someone’s page</b>: excuse a late mark, record a spot check or correct a time.</li>
          <li>To switch between HR and Employee, log out and sign in again choosing the other role.</li>
        </ul>
      </>)}
      <h3>Your day</h3><ol>
        <li><b>Clock in</b> on <b>Home</b>. Pick where you’re working ({remote ? 'Remote' : 'Office or Home'}, or Meeting / Event for demos and college visits), then tap Clock in. After {m2label(ge)} it’s a late mark.</li>
        <li><b>Add today’s tasks</b> by {m2label(hm2m(s.planBy))}. Type one and press Enter.</li>
        <li><b>As you work</b>, update each task’s status and tap + on your numbers. Stuck? Tap <b>Stuck on something?</b> to flag a blocker.</li>
        <li><b>Clock out</b> by {m2label(hm2m(s.eodBy))}. You’ll write 2–3 lines on what you did first.</li>
      </ol>
      <h3>The menu</h3><ul>
        <li><b>Home</b>: clock in/out, tasks and numbers for today.</li>
        <li><b>My attendance</b>: your month as a calendar. Tap any day to fix or plan it.</li>
        <li><b>Leave</b>: your balance, and the Apply leave button. HR approves each request.</li>
        <li><b>Weekly goals</b>: set 3–5 goals on Monday, review them on Friday, and read the senior’s feedback.</li>
        <li><b>Team</b>: who’s working right now, the attendance sheet and everyone’s weekly reviews.</li>
      </ul>
      <h3>Good to know</h3><ul>
        <li>The whole team can see each other’s day (check-ins, tasks, goals). Your personal details are visible only to you and HR.</li>
        <li>{s.latesPerHalfDay} late marks in a month = half a day of leave cut. Apply leave at least a day ahead so it counts as planned.</li>
      </ul>
      <div className="row end gap">
        <Link className="btn" href="/rules" onClick={close}>Read the full rules</Link>
        <button className="btn primary" onClick={close}>Got it</button>
      </div>
    </Modal>
  );
}
