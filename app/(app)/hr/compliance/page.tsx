import Link from 'next/link';
import { requireHr } from '@/lib/auth';
import { today as getToday, getSettings, team, getAllHr, loadDays, getConfig } from '@/lib/data';
import { monthSummary } from '@/lib/rules';
import { monthOf, dim } from '@/lib/time';
import { Topbar } from '@/components/Shell';
import { Chip } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ComplianceItem, type CState } from './ComplianceItem';

type Item = { k: string; th: number; t: string; law: string; f: string; w: React.ReactNode; need?: boolean };

const DL = ({ k, l }: { k: string; l: string }) => <a className="btn sm" href={`/api/registers/${k}`}><Icon n="dl" /> {l}</a>;

export default async function CompliancePage() {
  await requireHr();
  const [today, s, ppl, hrAll, C] = await Promise.all([getToday(), getSettings(), team(), getAllHr(), getConfig<Record<string, CState>>('compliance', {})]);
  const N = ppl.length;
  const jobs = ppl.map((p) => hrAll.get(p.id)?.job || {});
  const apptMissing = jobs.filter((j) => !j.apptLetterDate).length;
  const wageKnown = jobs.filter((j) => +j.wageMonthly > 0), esicN = wageKnown.filter((j) => +j.wageMonthly <= 21000).length, wageUnknown = N - wageKnown.length;
  const ym = monthOf(today);
  const days = await loadDays(ppl.map((p) => p.id), ym + '-01', `${ym}-${dim(ym)}`);
  const otDays = ppl.reduce((a, p) => a + monthSummary(s, p, days.get(p.id)!, ym, today).otDays, 0);

  const IT: Item[] = [
    { k: 'se', th: 0, t: N >= 20 ? 'Shops & Establishments registration' : 'Shops & Establishments intimation', law: 'Maharashtra Shops & Establishments Act 2017, as amended from 1 Oct 2025', f: 'Once; update on any change',
      w: N >= 20 ? 'With 20 or more workers you need a registration certificate. Apply on the Maharashtra labour portal within 60 days, and renew before it expires.' : 'With fewer than 20 workers you only file an intimation of your establishment (Form F; no certificate needed). Register when you reach 20 workers.' },
    { k: 'notices', th: 0, t: 'Name board in Marathi and notices on display', law: 'Maharashtra Shops & Establishments Act 2017', f: 'Once', w: 'Display the establishment name in Marathi (Devanagari) at the entrance, and put up notices of working hours, weekly off and holidays.' },
    { k: 'registers', th: 0, t: 'Statutory registers, kept for 5 years', law: 'Code on Wages 2019 and OSH Code 2020 (Maharashtra draft rules: electronic registers, 5-year retention)', f: 'Monthly; download and file',
      w: (<>Register of employees, attendance, leave, overtime and wages. The first four come from this portal:
        <div className="row gap wrap" style={{ marginTop: 6 }}><DL k="employees" l="Employees" /><DL k="muster" l="Muster roll" /><DL k="attendance" l="Attendance" /><DL k="leave" l="Leave" /><DL k="overtime" l="Overtime" /></div>
        <span className="note">The wage register and wage slips come from your payroll.</span></>) },
    { k: 'wages', th: 0, t: 'Pay on time and give wage slips', law: 'Code on Wages 2019, s.17', f: 'Monthly', w: 'Pay monthly wages by the 7th of the following month and give a wage slip on or before pay day. When someone leaves, settle their full dues within 2 working days. Keep the basic pay at least 50% of total pay, or allowances above 50% count as wages for PF and gratuity.' },
    { k: 'appt', th: 10, t: 'Appointment letter for every employee', law: 'OSH Code 2020, s.6', f: 'On joining',
      w: <>Every employee must get an appointment letter. <b>{apptMissing} of {N}</b> active employee{N > 1 ? 's' : ''} have none recorded. <Link className="link" href="/hr/records">Update in Employee records →</Link></> },
    { k: 'hours', th: 0, t: 'Working hours and overtime', law: 'OSH Code 2020', f: 'Ongoing',
      w: <>No more than {s.weeklyMaxHours} hours a week. Overtime only with the employee’s consent, paid at twice the normal rate. <b>{otDays}</b> overtime day{otDays === 1 ? '' : 's'} recorded this month (over {s.dailyMaxHours} h).</> },
    { k: 'leave', th: 10, t: 'Annual leave with wages', law: 'OSH Code 2020', f: 'Yearly',
      w: `At least 1 day for every 20 days worked once an employee has worked 180 days in the year; carry forward up to 30 days; unused leave paid out on exit. Your policy (${s.casualLeave} casual + ${s.earnedLeave} earned days) is more generous. Make sure late-mark cuts never take anyone below the legal minimum.` },
    { k: 'mlwf', th: 5, t: 'Maharashtra Labour Welfare Fund', law: 'Maharashtra Labour Welfare Fund Act 1953 (amended 2024)', f: 'Half-yearly', w: '₹25 from each employee and ₹75 from the company, for June and December. Deduct from June and December wages, pay by 15 July and 15 January, and file Form A-1 by 31 July and 31 January. Managerial staff are excluded.' },
    { k: 'pt', th: 0, t: 'Professional Tax', law: 'Maharashtra State Tax on Professions Act 1975', f: 'Monthly and yearly', w: 'The company pays its own PT under its enrolment certificate (PTEC) every year by 30 June. Deduct PT from salaries each month as per the slab and pay it under the registration certificate (PTRC).' },
    { k: 'esic', th: 10, t: 'ESIC (health insurance)', law: 'Code on Social Security 2020', f: 'Monthly', need: esicN > 0 || wageUnknown > 0,
      w: <>Covers employees earning ₹21,000 a month or less. <b>{esicN}</b> employee{esicN === 1 ? '' : 's'} in that range{wageUnknown ? `; wages not recorded for ${wageUnknown}` : ''}. If anyone is covered: register, pay 3.25% (company) + 0.75% (employee) by the 15th of the next month.</> },
    { k: 'posh', th: 10, t: 'Prevention of sexual harassment (POSH)', law: 'POSH Act 2013', f: 'Once, then yearly report', w: 'Set up an Internal Committee (a senior woman employee as presiding officer, plus an external member), adopt and display a written policy, run awareness sessions, and file the annual report with the District Officer.' },
    { k: 'gratuity', th: 10, t: 'Gratuity', law: 'Code on Social Security 2020', f: 'On exit', w: '15 days’ wages for every year of service, after 5 years (after 1 year for fixed-term staff), paid within 30 days of leaving. Consider a group gratuity insurance policy.' },
    { k: 'maternity', th: 10, t: 'Maternity benefit', law: 'Code on Social Security 2020', f: 'As needed', w: '26 weeks of paid maternity leave (12 weeks from the third child), with the option to work from home afterwards where the work allows.' },
    { k: 'epf', th: 20, t: 'Provident Fund (EPF)', law: 'Code on Social Security 2020', f: 'Monthly', w: `Mandatory once you employ 20 people: register within a month. 12% from the company and 12% from the employee. You can also join voluntarily earlier. You have ${N} now.` },
    { k: 'bonus', th: 20, t: 'Statutory bonus', law: 'Code on Wages 2019', f: 'Yearly', w: 'Once you employ 20 people: an annual bonus of 8.33% to 20% for employees earning up to the wage limit.' },
  ];
  const applies = (x: Item) => N >= x.th && x.need !== false;
  const now = IT.filter(applies), later = IT.filter((x) => !applies(x));
  const doneN = now.filter((x) => C[x.k]?.st === 'done' || C[x.k]?.st === 'na').length;
  const card = (x: Item, on: boolean) => (
    <article key={x.k} className={'card citem ' + (on ? '' : 'later')}>
      <div className="sec-h"><h3>{x.t}</h3>{on ? <ComplianceItem k={x.k} c={C[x.k] || {}} part="status" /> : <Chip c="mute">{x.th ? `From ${x.th} employees` : 'Not applicable now'}</Chip>}</div>
      <p className="note">{x.law} · {x.f}</p><div>{x.w}</div>
      {on && <ComplianceItem k={x.k} c={C[x.k] || {}} part="foot" />}
    </article>
  );
  return (
    <>
      <Topbar title="Compliance"><a className="btn primary sm" href="/api/registers/employees"><Icon n="dl" /> Register of employees</a></Topbar>
      <main id="app" className="anim">
        <section className="card"><div className="sec-h"><h3>Zetheta · Mumbai · office establishment</h3><Chip c={doneN === now.length ? 'ok' : 'warn'}>{doneN} of {now.length} done</Chip></div>
          <div className="hero-n"><b>{N}</b> employees on the team list</div>
          <div className="strip">{[5, 10, 20].map((n) => (
            <div key={n} className={N >= n ? 'ok' : ''}><b>{n}+</b><span>{n === 5 ? 'Labour Welfare Fund' : n === 10 ? 'OSH Code, ESIC, POSH, gratuity, maternity' : 'S&E registration, EPF, bonus'}</span></div>
          ))}</div>
          <p className="hint">Count everyone you employ, including part-timers and interns on your payroll, when checking these thresholds.</p>
        </section>
        <div className="banner" style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }}><span><b>Where the law stands:</b> the four labour codes (Wages, Social Security, OSH, Industrial Relations) have been in force since 21 November 2025. Maharashtra’s rules under them were still drafts when this checklist was written, so check thresholds and state rules before relying on it. This is not legal advice. Confirm with your CA or labour consultant.</span></div>
        <div className="sec-h"><h3>Applies to you now ({now.length})</h3></div>
        <div className="clist">{now.map((x) => card(x, true))}</div>
        <div className="sec-h"><h3>As you grow ({later.length})</h3></div>
        <div className="clist">{later.map((x) => card(x, false))}</div>
      </main>
    </>
  );
}
