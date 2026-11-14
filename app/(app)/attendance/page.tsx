import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays } from '@/lib/data';
import { monthSummary } from '@/lib/rules';
import { addMonth, monthOf, dim } from '@/lib/time';
import { Topbar } from '@/components/Shell';
import { ApplyLeaveButton } from '@/components/LeaveModal';
import { AttendanceView } from '@/components/AttendanceView';

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await requireUser();
  const [today, s] = await Promise.all([getToday(), getSettings()]);
  const sp = await searchParams;
  const cur = monthOf(today);
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= addMonth(cur, 2) ? sp.m : cur;
  const days = (await loadDays([me.id], ym + '-01', `${ym}-${dim(ym)}`)).get(me.id)!;
  const ms = monthSummary(s, { id: me.id, type: me.type }, days, ym, today);
  return (
    <>
      <Topbar title="My attendance"><ApplyLeaveButton s={s} today={today} /></Topbar>
      <main id="app" className="anim">
        <AttendanceView ym={ym} today={today} ms={ms} s={s} type={me.type} editable basePath="/attendance" />
      </main>
    </>
  );
}
