import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { SignInForm } from './SignInForm';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ left?: string }> }) {
  const me = await getMe();
  if (me?.mfaOk && me.status === 'active') redirect('/home');
  const sp = await searchParams;
  return (
    <div className="auth-wrap">
      <SignInForm notice={sp.left ? 'This account is closed. Ask HR if that’s a mistake.' : undefined} />
    </div>
  );
}
