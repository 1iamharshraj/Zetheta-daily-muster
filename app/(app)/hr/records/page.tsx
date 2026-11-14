import Link from 'next/link';
import { requireHr } from '@/lib/auth';
import { getPeople, getAllHr } from '@/lib/data';
import { shortName } from '@/lib/names';
import { profilePct } from '@/lib/profile';
import { dmy } from '@/lib/time';
import { WORKTYPE } from '@/lib/constants';
import { Topbar } from '@/components/Shell';
import { Avatar, Chip, PBar } from '@/components/ui';
import { Icon } from '@/components/Icon';

export default async function RecordsPage() {
  await requireHr();
  const [all, hrAll] = await Promise.all([getPeople(), getAllHr()]);
  const ppl = all.filter((p) => p.status !== 'pending');
  return (
    <>
      <Topbar title="Employee records"><a className="btn primary sm" href="/api/registers/employees"><Icon n="dl" /> Register of employees</a></Topbar>
      <main id="app" className="anim">
        <p className="hint">The register of employees. Tap Edit to add employment details and appointment-letter dates. Hover a profile bar to see what’s missing.</p>
        <div className="row gap wrap">
          {(['employees', 'attendance', 'leave', 'overtime'] as const).map((k) => (
            <a key={k} className="btn sm" href={`/api/registers/${k}`}><Icon n="dl" /> {k === 'employees' ? 'Register of employees' : k[0].toUpperCase() + k.slice(1) + ' register'}</a>
          ))}
          <a className="btn sm" href="/api/registers/payroll"><Icon n="dl" /> Payroll summary (this month)</a>
        </div>
        <section className="card"><div className="tbl" style={{ border: 0 }}><table>
          <thead><tr><th className="nm">Employee</th><th>Designation</th><th>Type</th><th>Joined</th><th>Appointment letter</th><th>Profile</th><th>Status</th><th /></tr></thead>
          <tbody>{ppl.map((p) => {
            const r = hrAll.get(p.id), job = r?.job || {}, pc = profilePct(r?.personal, !!p.photo, p.fullName), name = shortName(p.fullName);
            return (
              <tr key={p.id}>
                <td className="nm"><span className="row gap"><Avatar name={name} photo={p.photo} size="sm" /><span><b>{name}</b><br /><small className="muted">{p.empNo}</small></span></span></td>
                <td>{job.designation || p.role || '—'}</td>
                <td>{job.category || WORKTYPE[p.type]}</td>
                <td>{dmy(job.doj) || '—'}</td>
                <td>{job.apptLetterDate ? <Chip c="ok">Issued {dmy(job.apptLetterDate)}</Chip> : <Chip c="warn">Not recorded</Chip>}</td>
                <td title={pc.missing.length ? 'Missing: ' + pc.missing.join(', ') : 'Complete'}><span className="row gap" style={{ minWidth: 110 }}><PBar pct={pc.pct} title={pc.missing.length ? 'Missing: ' + pc.missing.join(', ') : 'Complete'} /><small>{pc.pct}%</small></span></td>
                <td>{p.status === 'left' ? <Chip c="mute">Left</Chip> : <Chip c="ok">Active</Chip>}</td>
                <td><Link className="btn sm" href={`/hr/records/${p.id}`}>Edit</Link></td>
              </tr>
            );
          })}</tbody>
        </table></div></section>
      </main>
    </>
  );
}
