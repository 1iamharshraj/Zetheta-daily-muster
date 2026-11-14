'use client';
import { useActionState, useEffect, useRef } from 'react';
import { changePassword } from '@/app/actions/auth';
import { useToast } from './ui';

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) { toast(state.ok); ref.current?.reset(); }
  }, [state, toast]);
  return (
    <form action={action} ref={ref} className="form" style={{ gridTemplateColumns: '1fr' }}>
      {!forced && <label className="fl">Current password<input name="current" type="password" autoComplete="current-password" /></label>}
      <label className="fl">New password<input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div className="row end"><button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button></div>
    </form>
  );
}
