'use client';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';

import { THEME_COOKIE, type Theme } from '@/lib/theme';

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E151A' : '#175F7F');
}

/** Light / Dark / Auto (follows the device). The server renders the saved choice, so there's no flash. */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [t, setT] = useState<Theme>(initial);
  useEffect(() => { apply(t); }, [t]);
  const opts: [Theme, IconName, string][] = [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['system', 'auto', 'Auto']];
  return (
    <div className="thsw" role="radiogroup" aria-label="Theme">
      {opts.map(([v, ic, l]) => (
        <button key={v} type="button" role="radio" aria-checked={t === v} className={t === v ? 'on' : ''} onClick={() => setT(v)} title={v === 'system' ? 'Follow this device' : `${l} mode`}>
          <Icon n={ic} /><span>{l}</span>
        </button>
      ))}
    </div>
  );
}
