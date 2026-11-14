'use client';
import { useActionState } from 'react';
import { verifyOtp, signOut } from '@/app/actions/auth';
import { AuthBrand } from '../SignInForm';

export function OtpForm({ qr, manualKey }: { qr: string | null; manualKey: string | null }) {
  const [state, action, pending] = useActionState(verifyOtp, undefined);
  return (
    <form action={action} className="card auth-card">
      <AuthBrand title="2-step verification" />
      {qr ? (
        <>
          <p className="muted">Scan with Google Authenticator or Microsoft Authenticator, then enter the code it shows.</p>
          <div className="qr"><img src={qr} alt="QR code for your authenticator app" /></div>
          <details className="manual"><summary>Can’t scan? Enter this key</summary>
            <code className="key">{(manualKey || '').replace(/(.{4})/g, '$1 ').trim()}</code>
          </details>
        </>
      ) : (
        <p className="muted">Enter the 6-digit code from your authenticator app.</p>
      )}
      <input name="code" className="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="6-digit code" autoFocus />
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn primary xl" disabled={pending}>{pending ? 'Checking…' : 'Verify'}</button>
      <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => signOut()}>Back</button>
    </form>
  );
}
