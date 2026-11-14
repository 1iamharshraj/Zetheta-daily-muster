import { requireUser } from '@/lib/auth';
import { getHr } from '@/lib/data';
import { shortName } from '@/lib/names';
import { Topbar } from '@/components/Shell';
import { ProfileForm } from '@/components/ProfileForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { PushToggle } from '@/components/PushToggle';

export default async function ProfilePage() {
  const me = await requireUser();
  const hr = await getHr(me.id);
  return (
    <>
      <Topbar title="My profile" />
      <main id="app" className="anim">
        <div className="toolbar"><div>
          <h2 className="nmh">{shortName(me.fullName)}<span className="eno-tag">{me.empNo}</span></h2>
          {me.email && <span className="role">{me.email}</span>}
        </div></div>
        <ProfileForm mode="self" personId={me.id} empNo={me.empNo} email={me.email || ''} fullName={me.fullName} photo={me.photo}
          personal={hr?.personal || {}} job={hr?.job || {}} />
        <div className="two">
          <section className="card"><div className="sec-h"><h3>Reminders on this device</h3></div><PushToggle /></section>
          <section className="card"><div className="sec-h"><h3>Change password</h3></div><ChangePasswordForm /></section>
        </div>
      </main>
    </>
  );
}
