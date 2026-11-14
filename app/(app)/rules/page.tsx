import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/data';
import { fmtLong, hm2m, m2label } from '@/lib/time';
import { Topbar } from '@/components/Shell';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** §6.13: plain-language rules generated from Settings. */
export default async function RulesPage() {
  await requireUser();
  const s = await getSettings();
  const st = hm2m(s.officeStart), ge = st + +s.graceMin;
  return (
    <>
      <Topbar title="Rules" />
      <main id="app" className="anim">
        <Link className="link back" href="/home">← Back to Home</Link>
        <section className="card"><div className="rules">
          <div><div className="eyebrow">In force from {fmtLong(s.goLive)}</div><h2>Attendance &amp; daily reporting rules</h2></div>
          <div><h3>1. Hours</h3><ul>
            <li>The working day starts at <b>{m2label(st)}</b>. Checking in after <b>{m2label(ge)}</b> is a late mark{s.lateAppliesToWfh ? ', on office and work-from-home days alike' : ' on office days'}.</li>
            <li>{s.weeklyHours} hours a week (never more than {s.weeklyMaxHours}). Time beyond {s.dailyMaxHours} hours in a day is recorded as overtime, which needs your consent and is paid at twice the normal rate.</li>
            <li>Hybrid team members spend at least <b>{s.officeDaysPerWeek} days a week in the office</b>; meetings, demos, events and Gamesdays count as office days. The remote team checks in as Remote.</li>
            <li>At a college, employer demo or event? Check in as <b>Meeting / Event</b> and say where. No late mark applies, but the senior sees where you were.</li>
            <li>Holidays and Gamesdays are set by HR. No late marks on Gamesday.</li>
          </ul></div>
          <div><h3>2. The daily routine (under 2 minutes)</h3><ol>
            <li>Clock in when you start: Office, Work from home, Remote or Meeting / Event.</li>
            <li>Add today’s tasks by <b>{m2label(hm2m(s.planBy))}</b>. Unfinished tasks from your last day can be carried over in one tap.</li>
            <li>Keep each task’s status up to date and update your numbers (calls, demos, MoUs…) during the day.</li>
            <li>Raise blockers as soon as they come up.</li>
            <li>Write your end-of-day summary and clock out by <b>{m2label(hm2m(s.eodBy))}</b>.</li>
          </ol></div>
          <div><h3>3. Late marks and cuts</h3><ul>
            <li>Every <b>{s.latesPerHalfDay} late marks</b> in a calendar month = <b>half a day of leave</b> deducted.</li>
            <li>Arriving more than <b>{s.severeLateMin} minutes</b> after start = half a day of leave for that day.</li>
            <li>Every 3 missed end-of-day summaries in a month count as one late mark.</li>
            <li>Late marks reset on the 1st of each month. HR may excuse a late mark when you informed them in advance.</li>
          </ul></div>
          <div><h3>4. Leave</h3><ul>
            <li>{s.casualLeave} days of casual leave and {s.earnedLeave} days of earned leave per leave year, starting {MONTHS[(+s.leaveYearStartMonth || 4) - 1]}. Late-mark cuts and absences come out of casual leave first, then earned leave.</li>
            <li>Every leave request goes to HR for approval. While it waits, it already counts against your balance.</li>
            <li>Leave applied at least one day ahead is <b>planned</b>. Leave applied on the day is <b>unplanned</b> and flagged.</li>
            <li>A working day with no check-in and no leave is marked <b>absent</b> and counts as one day of unplanned leave.</li>
            <li>Leave taken beyond the balance is <b>leave without pay</b>.</li>
          </ul></div>
          <div><h3>5. Honesty</h3><ul>
            <li>Clock in only when you have actually started work, and choose “Office” or “Meeting / Event” only when you are really there.</li>
            <li>HR does random spot checks. An office check-in when you weren’t there counts as an absent day.</li>
            <li>Clock-in and clock-out times come from the server clock, not your phone or laptop.</li>
            <li>Changes to past days need a reason. HR reviews each one and can reject it, which restores what was there before.</li>
          </ul></div>
          <div><h3>6. Weekly targets</h3><ul>
            <li>Set 3–5 targets every Monday by noon. Targets linked to daily numbers update themselves.</li>
            <li>Write a short self-review on Friday. The senior reviews each week and leaves feedback you can see.</li>
          </ul></div>
          <div><h3>7. Part-time members</h3><ul>
            <li>Clock in on the days you work and fill tasks and the summary. Late-mark and leave rules don’t apply.</li>
          </ul></div>
        </div></section>
      </main>
    </>
  );
}
