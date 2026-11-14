import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { shortName } from '@/lib/names';
import { signOut } from '@/app/actions/auth';

export default async function PendingPage() {
  const me = await getMe();
  if (!me || !me.mfaOk) redirect('/signin');
  if (me.status === 'active') redirect('/home');
  return (
    <div className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand"><img className="logo lg" src="/logo.png" alt="Zetheta" /><span><b>Zetheta Daily Muster</b></span></div>
        <h2>You’re registered, {shortName(me.fullName)}</h2>
        <p>Your employee code is <b>{me.empNo}</b>.</p>
        <p className="muted">HR needs to add you to the team before you can start. Once they have, reload this page or sign in again. No need to register twice.</p>
        <form action={signOut}><button className="btn">Log out</button></form>
      </section>
    </div>
  );
}
