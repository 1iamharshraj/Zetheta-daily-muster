import { requireUser } from '@/lib/auth';
import { getHr, getSettings } from '@/lib/data';
import { profilePct } from '@/lib/profile';
import { shortName } from '@/lib/names';
import { Shell } from '@/components/Shell';
import { Guide } from '@/components/Guide';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const [hr, s] = await Promise.all([getHr(me.id), getSettings()]);
  const pct = profilePct(hr?.personal, !!me.photo, me.fullName).pct;
  return (
    <Shell me={{ name: shortName(me.fullName), empNo: me.empNo, photo: me.photo, role: me.sessionRole, pct, superadmin: me.isSuperadmin }}>
      {children}
      <Guide autoOpen={!me.guideSeen} s={s} hr={me.sessionRole === 'hr'} remote={me.type === 'remote'} />
    </Shell>
  );
}
