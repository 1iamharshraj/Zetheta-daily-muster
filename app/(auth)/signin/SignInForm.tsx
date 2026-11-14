'use client';
import { useActionState, useState } from 'react';
import { signIn, register } from '@/app/actions/auth';
import { Icon } from '@/components/Icon';

export function AuthBrand({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="auth-top">
      <div className="auth-brand">
        <img className="logo lg" src="/logo.png" alt="Zetheta" />
        <span><b>{title}</b>{sub && <small>{sub}</small>}</span>
      </div>
      <details className="info">
        <summary aria-label="How sign-in works">i</summary>
        <div className="info-pop"><ul>
          <li>Sign in with your email ID (or employee code) and your muster password. Sessions last 12 hours.</li>
          <li>First time here? Choose “First time here?” and create your password. You’ll get your employee code (ZET-NNN) straight away.</li>
          <li>Your @zetheta.com email or a personal Gmail ID both work.</li>
          <li>Employee code is optional. If you use a Gmail ID that HR hasn’t added yet, it links you to the right record.</li>
          <li>HR also enters a 6-digit code from an authenticator app (Google or Microsoft Authenticator).</li>
          <li>Forgot your password? Ask HR to reset it.</li>
          <li>Only you and HR can see your personal records.</li>
        </ul></div>
      </details>
    </div>
  );
}

export function SignInForm({ notice }: { notice?: string }) {
  const [role, setRole] = useState<'employee' | 'hr'>('employee');
  const [first, setFirst] = useState(false);
  const [show, setShow] = useState(false);
  const [sState, sAction, sPending] = useActionState(signIn, undefined);
  const [rState, rAction, rPending] = useActionState(register, undefined);
  const err = first ? rState?.error : sState?.error;
  const pending = sPending || rPending;
  return (
    <form action={first ? rAction : sAction} className="card auth-card" noValidate>
      <AuthBrand title="Zetheta Daily Muster" />
      <h2>{first ? 'Create your account' : 'Sign in'}</h2>
      {notice && <p className="note">{notice}</p>}
      <div className="modes" role="radiogroup" aria-label="Sign in as">
        {(['employee', 'hr'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={role === k} className={'mode ' + (role === k ? 'on' : '')} onClick={() => setRole(k)}>
            {k === 'hr' ? 'HR' : 'Employee'}
          </button>
        ))}
      </div>
      <input type="hidden" name="role" value={role} />
      <label className="fl">{first ? 'Email ID' : 'Email ID or employee code'}
        <input name="email" type={first ? 'email' : 'text'} autoComplete={first ? 'email' : 'username'} autoCapitalize="none" required
          placeholder={first ? 'name@zetheta.com or name@gmail.com' : 'name@zetheta.com or ZET-012'} />
      </label>
      {first && (
        <label className="fl">Full name
          <input name="name" type="text" autoComplete="name" maxLength={60} placeholder="As in your documents, e.g. Krish Shah" />
        </label>
      )}
      {first && (
        <label className="fl"><span>{role === 'hr' ? 'HR code' : 'Employee code'} <span className="opt">(optional)</span></span>
          <input name="code" type="text" maxLength={10} placeholder="ZET-000" autoComplete="off" />
        </label>
      )}
      <label className="fl">Password
        <span className="pw">
          <input name="password" type={show ? 'text' : 'password'} autoComplete={first ? 'new-password' : 'current-password'} placeholder={first ? 'At least 8 characters' : ''} required />
          <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
            <Icon n={show ? 'eyeoff' : 'eye'} />
          </button>
        </span>
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary xl" disabled={pending}>{pending ? 'Please wait…' : first ? 'Create account' : role === 'hr' ? 'Continue' : 'Sign in'}</button>
      <p className="auth-switch">
        {first ? 'Already have an account? ' : 'First time here? '}
        <button type="button" className="link" onClick={() => setFirst(!first)}>{first ? 'Sign in' : 'Create your password'}</button>
      </p>
    </form>
  );
}
