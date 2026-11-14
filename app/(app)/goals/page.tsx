import { requireUser } from '@/lib/auth';
import { today as getToday, getSettings, loadDays, getWeeks } from '@/lib/data';
import { weekSummary, tPct, tDone } from '@/lib/rules';
import { addD, monday } from '@/lib/time';
import { Topbar } from '@/components/Shell';
import { GoalsClient } from './GoalsClient';

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const me = await requireUser();
  const [today, s] = await Promise.all([getToday(), getSettings()]);
  const sp = await searchParams;
  const w = sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? monday(sp.w) : monday(today);
  const [days, weeks] = await Promise.all([loadDays([me.id], w, addD(w, 6)), getWeeks([me.id], w)]);
  const wk = weekSummary(s, { id: me.id, type: me.type }, days.get(me.id)!, w, today);
  const doc = weeks.get(me.id);
  const targets = (doc?.targets || []).map((x) => ({ ...x, cur: tDone(x, wk) }));
  return (
    <>
      <Topbar title="Weekly goals"><a className="btn primary sm" href="#tg-text">+ Add a goal</a></Topbar>
      <main id="app" className="anim">
        <GoalsClient
          w={w} thisWeek={monday(today)} type={me.type} metrics={me.metrics} s={s}
          targets={targets} pct={tPct(doc?.targets, wk)} selfReview={doc?.selfReview || ''}
          senior={{ status: doc?.seniorStatus || null, comment: doc?.seniorComment || '' }}
          wk={{ office: wk.office, worked: wk.office + wk.wfh, hours: wk.hours, metrics: wk.metrics }}
        />
      </main>
    </>
  );
}
