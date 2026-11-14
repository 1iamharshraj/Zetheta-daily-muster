import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export default async function ChangePasswordPage() {
  const me = await getMe();
  if (!me || !me.mfaOk) redirect('/signin');
  if (!me.mustChangePassword) redirect('/profile');
  return (
    <div className="auth-wrap">
      <section className="card auth-card">
        <div className="auth-brand"><img className="logo lg" src="/logo.png" alt="Zetheta" /><span><b>Set a new password</b></span></div>
        <p className="muted">HR reset your password. Choose a new one to continue.</p>
        <ChangePasswordForm forced />
      </section>
    </div>
  );
}
