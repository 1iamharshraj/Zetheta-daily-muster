import Link from 'next/link';
import { requireHr } from '@/lib/auth';
import { getPeople, getSettings } from '@/lib/data';
import { shortName } from '@/lib/names';
import { dmy } from '@/lib/time';
import { emailEnabled, pushEnabled } from '@/lib/notify';
import { Topbar } from '@/components/Shell';
import { RulesForm, Roster, Pending, Accounts } from './SettingsClient';

export default async function SettingsPage() {
  const me = await requireHr();
  const [s, all] = await Promise.all([getSettings(), getPeople()]);
  const toRow = (p: (typeof all)[number]) => ({
    id: p.id, name: shortName(p.fullName), fullName: p.fullName, role: p.role, email: p.email || '', empNo: p.empNo, type: p.type,
    active: p.status === 'active', metrics: p.metrics, isHr: p.isHr, isSuperadmin: p.isSuperadmin, hasAccount: p.hasAccount, totpOn: p.totpOn,
    lastSignIn: p.lastSignIn ? p.lastSignIn.toISOString() : null,
  });
  const people = all.filter((p) => p.status !== 'pending').map(toRow);
  const pending = all.filter((p) => p.status === 'pending').map((p) => ({ id: p.id, name: p.fullName, email: p.email || '', empNo: p.empNo }));
  return (
    <>
      <Topbar title="Settings" />
      <main id="app" className="anim">
        {pending.length > 0 && <Pending pending={pending} free={people.filter((p) => !p.hasAccount && p.active).map((p) => ({ id: p.id, name: p.name }))} />}
        <div className="toolbar"><h2>Settings</h2><Link className="btn sm" href="/rules">See the rules as the team sees them</Link></div>
        <RulesForm s={{ ...s, goLive: dmy(s.goLive), holidays: s.holidays.map((h) => dmy(h.slice(0, 10)) + h.slice(10)), gamesdays: s.gamesdays.map(dmy) }}
          channels={{ email: emailEnabled(), push: pushEnabled() }} />
        <Roster people={people} meId={me.id} superadmin={me.isSuperadmin} />
        <Accounts people={people.filter((p) => p.hasAccount)} meId={me.id} superadmin={me.isSuperadmin} />
      </main>
    </>
  );
}
