import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { dbNow, getSettings, loadDays, getWeeks } from '@/lib/data';
import { isWorkday, liveLeave } from '@/lib/rules';
import { dow, hm2m, keyOf, m2label, minsOf, monday } from '@/lib/time';
import { deliver } from '@/lib/notify';
import { shortName } from '@/lib/names';

export const dynamic = 'force-dynamic';

/**
 * v2 P1 reminders. Call every 10–15 minutes during the working day
 * (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; external pingers can use ?key=).
 * Each reminder goes out at most once per person per day (reminder_log).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || (auth !== `Bearer ${secret}` && req.nextUrl.searchParams.get('key') !== secret)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const now = await dbNow();
  const k = keyOf(now), m = minsOf(now), s = await getSettings();
  if (!isWorkday(s, k) || k < s.goLive) return NextResponse.json({ skipped: 'not a working day' });

  const ppl = await db.select().from(t.people).where(and(eq(t.people.status, 'active'), sql`${t.people.passwordHash} is not null`));
  const ids = ppl.map((p) => p.id);
  const [days, weeks] = await Promise.all([loadDays(ids, k, k), getWeeks(ids, monday(k))]);
  const start = hm2m(s.officeStart), grace = start + +s.graceMin, planBy = hm2m(s.planBy), eodBy = hm2m(s.eodBy);
  const sent: string[] = [];

  for (const p of ppl) {
    const rec = days.get(p.id)![k], lv = liveLeave(rec?.leave), full = !!(lv && !lv.half), wk = weeks.get(p.id), first = shortName(p.fullName);
    const due: [string, string, string, string][] = [];
    if (!full && p.type !== 'part' && !rec?.checkInAt && m >= grace && m < start + 240)
      due.push(['checkin', 'You haven’t clocked in yet', `${first}, it’s past ${m2label(grace)}. Clock in now, or apply leave if you’re off today.`, '/home']);
    if (rec?.checkInAt && !(rec.plan || []).length && m >= planBy)
      due.push(['plan', 'Add today’s tasks', `Plan your day: tasks were due by ${m2label(planBy)}.`, '/home#sec-tasks']);
    if (rec?.checkInAt && !rec.checkOutAt && m >= eodBy && m < eodBy + 180)
      due.push(['eod', 'Write your summary and clock out', `It’s past ${m2label(eodBy)}. Add 2–3 lines on your day and clock out.`, '/home']);
    if (dow(k) === 1 && !full && m >= start + 60 && !(wk?.targets || []).length)
      due.push(['targets', 'Set this week’s targets', 'Add 3–5 targets for the week by noon.', '/goals']);
    if (dow(k) === 5 && !full && m >= eodBy - 120 && !wk?.selfReview)
      due.push(['review', 'Friday self-review', 'Two lines: what went well, what slipped, what you need.', '/goals']);

    for (const [kind, title, body, url] of due) {
      const ins = await db.insert(t.reminderLog).values({ personId: p.id, date: k, kind }).onConflictDoNothing().returning();
      if (!ins.length) continue;
      await deliver(p, title, body, url, { email: s.reminders?.email !== false, push: s.reminders?.push !== false });
      sent.push(`${p.empNo}:${kind}`);
    }
  }
  return NextResponse.json({ at: now.toISOString(), sent });
}
