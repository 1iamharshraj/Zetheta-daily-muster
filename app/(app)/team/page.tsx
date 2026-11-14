import { requireUser } from '@/lib/auth';
import { dbNow, getSettings, loadDays, team, getPeople } from '@/lib/data';
import { dayInfo, isWorkday, liveLeave } from '@/lib/rules';
import { addD, keyOf, minsOf, hm2m, fmtShort, tLabel } from '@/lib/time';
import { MODES } from '@/lib/constants';
import { shortName } from '@/lib/names';
import { Topbar, AutoRefresh } from '@/components/Shell';
import { TeamClient, type PulseRow, type Attn } from './TeamClient';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const me = await requireUser();
  const [now, s, ppl, all] = await Promise.all([dbNow(), getSettings(), team(), getPeople()]);
  const today = keyOf(now), nowM = minsOf(now), hr = me.sessionRole === 'hr';
  const sp = await searchParams;
  const d = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d <= today ? sp.d : today;
  let pw = addD(d, -1);
  for (let j = 0; j < 10 && !isWorkday(s, pw); j++) pw = addD(pw, -1);
  const daysMap = await loadDays(ppl.map((p) => p.id), addD(d, -14), d);
  const graceOver = d < today || nowM > hm2m(s.officeStart) + +s.graceMin;

  const rows: PulseRow[] = [];
  const attn: Attn[] = [];
  for (const p of ppl) {
    const days = daysMap.get(p.id)!, rec = days[d], i = dayInfo(s, p, d, rec, today), name = shortName(p.fullName);
    const lv = liveLeave(rec?.leave), full = !!(lv && !lv.half);
    const ci = !!rec?.checkInAt;
    const f = {
      office: ci && (rec!.mode === 'office' || !rec!.mode), meeting: ci && rec!.mode === 'meeting', remote: ci && (rec!.mode === 'wfh' || rec!.mode === 'remote'),
      late: i.late || i.severe, leave: full,
      missing: p.hasAccount && !ci && !full && p.type !== 'part' && isWorkday(s, d) && graceOver,
    };
    let chip: [string, string];
    if (!p.hasAccount && !ci) chip = ['Not signed in yet', 'mute'];
    else if (rec?.spot === 'no') chip = ['Not in office (spot check)', 'bad'];
    else if (full) chip = [lv!.status === 'pending' ? 'Leave (awaiting HR)' : i.unplanned ? 'Unplanned leave' : 'On leave', i.unplanned ? 'bad' : 'info'];
    else if (ci) {
      const M = MODES[rec!.mode || 'office'], tm = tLabel(rec!.checkInAt);
      chip = i.severe ? [`${M.label} · ${tm} · +${i.lateMins}m`, 'bad'] : i.late ? [`${M.label} · ${tm} · +${i.lateMins}m`, 'warn'] : [`${M.label} · ${tm}${i.excusedLate ? ' · excused' : ''}`, M.cls];
    } else if (p.type === 'part') chip = ['Not working today', 'mute'];
    else if (!isWorkday(s, d)) chip = ['Day off', 'mute'];
    else if (d < today) chip = ['Absent', 'bad'];
    else if (graceOver) chip = ['Not checked in', 'bad'];
    else chip = ['Not in yet', 'mute'];
    const blocked = !!(rec?.blocker?.text && !rec.blocker.resolved) || (rec?.plan || []).some((x) => x.status === 'blocked');
    rows.push({
      id: p.id, name, empNo: p.empNo, role: p.role, photo: p.photo, chip, tasks: i.tasks, blocked, f,
      canSpot: hr && d === today && ci && rec!.mode === 'office' && !rec!.spot,
    });
    if (!hr) continue;
    const push = (txt: string, c: string) => attn.push({ id: p.id, name, txt, c });
    if (rec?.spot === 'no') push('Not found in office at the spot check', 'bad');
    if (i.severe) push(`Checked in ${i.lateMins} min late (counts as a half day)`, 'bad');
    else if (i.late) push(`Checked in ${i.lateMins} min late`, 'warn');
    if (lv && i.unplanned) push('Took unplanned leave', 'bad');
    if (!ci && !full && p.hasAccount && p.type !== 'part' && isWorkday(s, d) && d >= s.goLive && graceOver) push(d < today ? 'No check-in and no leave (absent)' : 'Hasn’t checked in yet', 'bad');
    if (ci && !i.tasks[1] && (d < today || nowM > hm2m(s.planBy))) push('Checked in but planned no tasks', 'warn');
    if (rec?.blocker?.text && !rec.blocker.resolved) push('Blocker: ' + rec.blocker.text, 'bad');
    (rec?.plan || []).filter((x) => x.status === 'blocked').forEach((x) => push('Task blocked, needs help: ' + x.text, 'bad'));
    Object.values(days).filter((x) => x.date >= addD(today, -14) && x.edit?.status === 'pending').forEach((x) => push(`Edited ${fmtShort(x.date)}: ${(x.edit as { reason?: string }).reason || 'no reason'}`, 'warn'));
    const pr = days[pw];
    if (pw >= s.goLive && pr?.checkInAt && !pr.eod) push(`Didn’t submit a summary for ${fmtShort(pw)}`, 'warn');
  }
  if (hr) all.filter((p) => p.status === 'pending').forEach((p) => attn.unshift({ id: 0, name: shortName(p.fullName), txt: 'Registered and waiting to be added to the team.', c: 'warn' }));

  return (
    <>
      <Topbar title="Team overview" />
      <AutoRefresh seconds={30} />
      <TeamClient d={d} today={today} serverNow={now.getTime()} rows={rows} attn={hr ? attn : null} />
    </>
  );
}
