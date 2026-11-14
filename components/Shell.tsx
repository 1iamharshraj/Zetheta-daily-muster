'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Avatar, Modal, PBar } from './ui';
import { signOut } from '@/app/actions/auth';
import { TZ } from '@/lib/time';
import { openGuide } from './Guide';
import { ThemeSwitch } from './ThemeSwitch';
import type { Theme } from '@/lib/theme';

export type ShellMe = { name: string; empNo: string; photo: string | null; role: 'employee' | 'hr'; pct: number; superadmin?: boolean };
const roleLabel = (me: ShellMe) => (me.role === 'hr' ? (me.superadmin ? 'Superadmin' : 'HR') : 'Employee');

export type DayState = 'none' | 'in' | 'out' | 'leave';
type Link_ = { h: string; l: string; i: IconName };
type Group = { g: string; items: Link_[] };
const groups = (hr: boolean): Group[] => [
  { g: 'My space', items: [{ h: '/home', l: 'Home', i: 'home' }, { h: '/attendance', l: 'My attendance', i: 'cal' }, { h: '/leave', l: 'Leave', i: 'leave' }, { h: '/goals', l: 'Weekly goals', i: 'goal' }] },
  { g: 'Team', items: [{ h: '/team', l: 'Team overview', i: 'pulse' }, { h: '/sheet', l: 'Attendance sheet', i: 'table' }, { h: '/reviews', l: 'Weekly reviews', i: 'chat' }] },
  ...(hr ? [{ g: 'HR', items: [{ h: '/hr', l: 'HR desk', i: 'flag' as IconName }, { h: '/hr/records', l: 'Employee records', i: 'folder' as IconName }, { h: '/hr/compliance', l: 'Compliance', i: 'shield' as IconName }, { h: '/hr/settings', l: 'Settings', i: 'gear' as IconName }] }] : []),
  { g: 'More', items: [{ h: '/rules', l: 'Rules', i: 'book' }] },
];
const bnav = (hr: boolean): Link_[] => hr
  ? [{ h: '/home', l: 'Home', i: 'home' }, { h: '/team', l: 'Team', i: 'pulse' }, { h: '/hr', l: 'HR desk', i: 'flag' }, { h: '/sheet', l: 'Sheet', i: 'table' }]
  : [{ h: '/home', l: 'Home', i: 'home' }, { h: '/attendance', l: 'Attendance', i: 'cal' }, { h: '/leave', l: 'Leave', i: 'leave' }, { h: '/team', l: 'Team', i: 'pulse' }];

const isCur = (path: string, h: string) => (h === '/hr' ? path === '/hr' : path === h || path.startsWith(h + '/'));
const STATE: Record<DayState, [string, string]> = { none: ['Not in', 'warn'], in: ['In', 'ok'], out: ['Done', 'mute'], leave: ['Leave', 'info'] };

function MeCard({ me, path }: { me: ShellMe; path: string }) {
  return (
    <Link className="sb-me" href="/profile" aria-current={path === '/profile' ? 'page' : undefined} title={`${me.pct < 100 ? 'Complete' : 'View'} my profile · ${me.pct}% complete`}>
      <Avatar name={me.name} photo={me.photo} />
      <span className="sb-me-t">
        <b>{me.name}</b>
        <span className="sb-tags"><small className="eno">{me.empNo}</small><small className={'sb-role r-' + roleLabel(me).toLowerCase()}>{roleLabel(me)}</small></span>
        {me.pct < 100 && <span className="sb-pct"><PBar pct={me.pct} /><small>{me.pct}%</small></span>}
      </span>
      <Icon n="edit" c="arr" />
    </Link>
  );
}

function NavLinks({ items, path, state, hrCount }: { items: Link_[]; path: string; state: DayState; hrCount: number }) {
  return (
    <>{items.map((x) => (
      <Link key={x.h} className="nv" href={x.h} aria-current={isCur(path, x.h) ? 'page' : undefined}>
        <Icon n={x.i} /><span>{x.l}</span>
        {x.h === '/home' && <span className={'nd ' + STATE[state][1]} title={`Today: ${STATE[state][0]}`}>{STATE[state][0]}</span>}
        {x.h === '/hr' && hrCount > 0 && <span className="nb" title={`${hrCount} waiting for HR`}>{hrCount > 99 ? '99+' : hrCount}</span>}
      </Link>
    ))}</>
  );
}

function Foot({ me, theme }: { me: ShellMe; theme: Theme }) {
  return (
    <div className="sbfoot">
      <ThemeSwitch initial={theme} />
      <div className="sb-out">
        <span className="rolesw"><span>Logged in as</span><b>{roleLabel(me)}</b></span>
        <button type="button" className="nv logout" onClick={() => signOut()} title="Log out" aria-label="Log out"><Icon n="out" /><span className="lo-t">Log out</span></button>
      </div>
    </div>
  );
}

export function Shell({ me, state = 'none', hrCount = 0, theme = 'system', children }: { me: ShellMe; state?: DayState; hrCount?: number; theme?: Theme; children: React.ReactNode }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const hr = me.role === 'hr';
  const gs = groups(hr);
  return (
    <div className="app">
      <aside className="side" aria-label="Main menu">
        <Link href="/home" className="sb-brand"><img className="logo" src="/logo.png" alt="" /><span><b>Daily Muster</b><small>Zetheta Algorithms</small></span></Link>
        <MeCard me={me} path={path} />
        <nav className="sb-nav">
          {gs.map((g) => (
            <div key={g.g} className="sb-grp"><div className="ng">{g.g}</div><NavLinks items={g.items} path={path} state={state} hrCount={hrCount} /></div>
          ))}
        </nav>
        <Foot me={me} theme={theme} />
      </aside>
      <div className="body">{children}</div>
      <nav className="bnav" aria-label="Main menu">
        {bnav(hr).map((x) => (
          <Link key={x.h} href={x.h} aria-current={isCur(path, x.h) ? 'page' : undefined}>
            <Icon n={x.i} /><span>{x.l}</span>
            {x.h === '/hr' && hrCount > 0 && <span className="nb">{hrCount}</span>}
          </Link>
        ))}
        <a href="#" onClick={(e) => { e.preventDefault(); setMore(true); }}><Icon n="menu" /><span>More</span></a>
      </nav>
      {more && (
        <Modal title="Menu" onClose={() => setMore(false)}>
          <nav className="mmenu" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMore(false); }}>
            <MeCard me={me} path={path} />
            {gs.map((g) => <div key={g.g} className="sb-grp"><div className="ng">{g.g}</div><NavLinks items={g.items} path={path} state={state} hrCount={hrCount} /></div>)}
            <Foot me={me} theme={theme} />
          </nav>
        </Modal>
      )}
    </div>
  );
}

const fT = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const fL = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' });

/** Top bar with page title, live date/time and the page's single primary CTA. */
export function Topbar({ title, children, skew = 0 }: { title: string; children?: React.ReactNode; skew?: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const f = () => setNow(new Date(Date.now() + skew));
    f();
    const id = setInterval(f, 15000);
    return () => clearInterval(id);
  }, [skew]);
  return (
    <header className="topbar"><div className="tb-in">
      <div className="tb-title"><span className="mbrand">Zetheta <b>Muster</b></span><h1>{title}</h1></div>
      <div className="row gap"><span className="tb-date">{now ? `${fL.format(now)} · ${fT.format(now).toUpperCase()}` : ''}</span>{children}<button className="btn sm helpb" type="button" onClick={openGuide}>Help</button></div>
    </div></header>
  );
}

/** Re-fetch server data periodically and when the tab regains focus (live team views). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const busy = () => {
      const a = document.activeElement;
      return (!!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || !!document.querySelector('.overlay');
    };
    const tick = () => { if (document.visibilityState === 'visible' && !busy()) router.refresh(); };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [router, seconds]);
  return null;
}
