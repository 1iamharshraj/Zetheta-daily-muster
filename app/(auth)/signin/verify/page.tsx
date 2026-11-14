import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getMe, ensureTotpSetup } from '@/lib/auth';
import { OtpForm } from './OtpForm';

export default async function VerifyPage() {
  const me = await getMe();
  if (!me) redirect('/signin');
  if (me.mfaOk) redirect('/home');
  let qr: string | null = null, key: string | null = null;
  if (!me.totpOn) {
    key = await ensureTotpSetup(me.sessionId);
    const uri = `otpauth://totp/${encodeURIComponent('Zetheta Muster:' + (me.email || me.empNo))}?secret=${key}&issuer=${encodeURIComponent('Zetheta Muster')}`;
    qr = await QRCode.toDataURL(uri, { margin: 1, width: 360 });
  }
  return (
    <div className="auth-wrap">
      <OtpForm qr={qr} manualKey={key} />
    </div>
  );
}
