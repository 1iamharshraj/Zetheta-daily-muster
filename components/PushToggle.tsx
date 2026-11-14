'use client';
import { useEffect, useState } from 'react';
import { useAction } from './ui';
import { subscribePush, unsubscribePush } from '@/app/actions/push';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const b64ToBytes = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

export function PushToggle() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'off' | 'on' | 'blocked' | 'nokey'>('loading');
  const { run, pending } = useAction();
  useEffect(() => {
    (async () => {
      if (!KEY) return setState('nokey');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      const reg = await navigator.serviceWorker.register('/sw.js');
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  const on = () => run(async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setState('blocked'); return { error: 'Notifications are blocked. Allow them in your browser settings.' }; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY) });
    const r = await subscribePush(sub.toJSON() as never);
    if (!r.error) setState('on');
    return r;
  });
  const off = () => run(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await unsubscribePush(sub.endpoint); await sub.unsubscribe(); }
    setState('off');
    return { ok: 'Reminders turned off for this device.' };
  });

  return (
    <>
      <p className="hint">Get a nudge on this phone or computer if you haven’t clocked in, planned tasks or written your summary on time. Reminders also come by email.</p>
      {state === 'nokey' && <p className="note">Browser reminders aren’t set up on the server yet. Email reminders still work.</p>}
      {state === 'unsupported' && <p className="note">This browser can’t show reminders. On iPhone, add the muster to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>}
      {state === 'blocked' && <p className="note">Notifications are blocked for this site. Allow them in your browser’s site settings, then reload.</p>}
      {state === 'off' && <div className="row"><button className="btn primary" disabled={pending} onClick={on}>Turn on reminders</button></div>}
      {state === 'on' && <div className="row gap"><span className="chip ok">On for this device</span><button className="btn sm" disabled={pending} onClick={off}>Turn off</button></div>}
    </>
  );
}
