import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getHr, getSettings, today as getToday } from '@/lib/data';
import { getDay, liveLeaveOn } from '@/lib/day';
import { profilePct } from '@/lib/profile';
import { shortName } from '@/lib/names';
import { asTheme, THEME_COOKIE } from '@/lib/theme';
import { Shell, type DayState } from '@/components/Shell';
import { Guide } from '@/components/Guide';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const hrView = me.sessionRole === 'hr';
  const today = await getToday();
  const [hr, s, day, lv, waiting, jar] = await Promise.all([
    getHr(me.id), getSettings(), getDay(me.id, today), liveLeaveOn(me.id, today),
    // Everything waiting for HR: leave requests (grouped like the HR desk), past-day edits, new sign-ups.
    hrView ? db.execute<{ n: string }>(sql`select (
        (select count(distinct (person_id, applied_at, kind, half)) from leaves where status = 'pending')
      + (select count(*) from day_logs where edit->>'status' = 'pending')
      + (select count(*) from people where status = 'pending'))::text as n`) : null,
    cookies(),
  ]);
  const pct = profilePct(hr?.personal, !!me.photo, me.fullName).pct;
  const state: DayState = lv && !lv.half ? 'leave' : day?.checkOutAt ? 'out' : day?.checkInAt ? 'in' : 'none';
  return (
    <Shell
      me={{ name: shortName(me.fullName), empNo: me.empNo, photo: me.photo, role: me.sessionRole, pct, superadmin: me.isSuperadmin }}
      state={state} hrCount={waiting ? +waiting.rows[0].n : 0} theme={asTheme(jar.get(THEME_COOKIE)?.value)}
    >
      {children}
      <Guide autoOpen={!me.guideSeen} s={s} hr={hrView} remote={me.type === 'remote'} />
    </Shell>
  );
}
