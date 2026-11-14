'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Avatar, Modal, PBar } from './ui';
import { signOut } from '@/app/actions/auth';
import { TZ } from '@/lib/time';
import { openGuide } from './Guide';

export type ShellMe = { name: string; empNo: string; photo: string | null; role: 'employee' | 'hr'; pct: number; superadmin?: boolean };
const roleLabel = (me: ShellMe) => (me.role === 'hr' ? (me.superadmin ? 'Superadmin' : 'HR') : 'Employee');

type Item = { g: string } | { h: string; l: string; i: IconName };
const nav = (hr: boolean): Item[] => [
  { g: 'My space' },
  { h: '/home', l: 'Home', i: 'home' }, { h: '/attendance', l: 'My attendance', i: 'cal' },
  { h: '/leave', l: 'Leave', i: 'leave' }, { h: '/goals', l: 'Weekly goals', i: 'goal' },
  { g: 'Team' },
  { h: '/team', l: 'Team overview', i: 'pulse' }, { h: '/sheet', l: 'Attendance sheet', i: 'table' }, { h: '/reviews', l: 'Weekly reviews', i: 'chat' },
  ...(hr ? [{ g: 'HR' }, { h: '/hr', l: 'HR desk', i: 'leave' as IconName }, { h: '/hr/records', l: 'Employee records', i: 'folder' as IconName },
    { h: '/hr/compliance', l: 'Compliance', i: 'shield' as IconName }, { h: '/hr/settings', l: 'Settings', i: 'gear' as IconName }] : []),
  { g: 'More' }, { h: '/rules', l: 'Rules', i: 'book' },
];
const bnav = (hr: boolean): { h: string; l: string; i: IconName }[] => hr
  ? [{ h: '/home', l: 'Home', i: 'home' }, { h: '/team', l: 'Team', i: 'pulse' }, { h: '/hr', l: 'HR desk', i: 'leave' }, { h: '/sheet', l: 'Sheet', i: 'table' }]
  : [{ h: '/home', l: 'Home', i: 'home' }, { h: '/attendance', l: 'Attendance', i: 'cal' }, { h: '/leave', l: 'Leave', i: 'leave' }, { h: '/team', l: 'Team', i: 'pulse' }];

const isCur = (path: string, h: string) => (h === '/hr' ? path === '/hr' : path === h || path.startsWith(h + '/'));

function MeCard({ me, path }: { me: ShellMe; path: string }) {
  return (
    <Link className="sb-me" href="/profile" aria-current={path === '/profile' ? 'page' : undefined} title={`${me.pct < 100 ? 'Complete' : 'View'} my profile · ${me.pct}% complete`}>
      <Avatar name={me.name} photo={me.photo} />
      <span><b>{me.name}</b><small className="eno">{me.empNo} · {roleLabel(me)}</small>{me.pct < 100 && <PBar pct={me.pct} />}</span>
      <Icon n="edit" c="arr" />
    </Link>
  );
}

function Foot({ me }: { me: ShellMe }) {
  return (
    <div className="sbfoot">
      <div className="rolesw"><span>Logged in as</span><b>{roleLabel(me)}</b></div>
      <button type="button" className="nv logout" onClick={() => signOut()}><Icon n="out" /><span>Log out</span></button>
    </div>
  );
}

export function Shell({ me, children }: { me: ShellMe; children: React.ReactNode }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const hr = me.role === 'hr';
  const items = nav(hr);
  return (
    <div className="app">
      <aside className="side" aria-label="Main menu">
        <div className="sb-brand"><img className="logo" src="/logo.png" alt="Zetheta" /><span><b>Daily Muster</b><small>Zetheta</small></span></div>
        {items.map((x, j) => 'g' in x
          ? <div key={j} className="ng">{x.g}</div>
          : <Link key={x.h} className="nv" href={x.h} aria-current={isCur(path, x.h) ? 'page' : undefined}><Icon n={x.i} /><span>{x.l}</span></Link>,
        ).flatMap((el, j) => (j === 0 ? [el, <MeCard key="me" me={me} path={path} />] : [el]))}
        <Foot me={me} />
      </aside>
      <div className="body">{children}</div>
      <nav className="bnav" aria-label="Main menu">
        {bnav(hr).map((x) => (
          <Link key={x.h} href={x.h} aria-current={isCur(path, x.h) ? 'page' : undefined}><Icon n={x.i} /><span>{x.l}</span></Link>
        ))}
        <a href="#" onClick={(e) => { e.preventDefault(); setMore(true); }}><Icon n="menu" /><span>More</span></a>
      </nav>
      {more && (
        <Modal title="Menu" onClose={() => setMore(false)}>
          <nav className="mmenu" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMore(false); }}>
            <MeCard me={me} path={path} />
            {items.filter((x): x is { h: string; l: string; i: IconName } => 'h' in x).map((x) => (
              <Link key={x.h} className="nv" href={x.h} aria-current={isCur(path, x.h) ? 'page' : undefined}><Icon n={x.i} /><span>{x.l}</span></Link>
            ))}
            <Foot me={me} />
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
