/**
 * Dev/demo seed. Creates an HR account plus the v1 sample team with two weeks of history.
 *   npm run db:seed            (refuses to run if people already exist)
 *   npm run db:seed -- --force (wipes all data first; NEVER on production)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as t from '../lib/db/schema';
import { hashPassword } from '../lib/crypto';
import { computeLate } from '../lib/rules';
import { DEFAULTS } from '../lib/settings';
import { defaultMetrics } from '../lib/constants';
import { ROSTER } from './roster-data';
import { addD, dow, isoAt, keyOf, monday } from '../lib/time';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: t });
const force = process.argv.includes('--force');

const [{ n }] = (await db.execute<{ n: string }>(sql`select count(*)::text as n from people`)).rows;
if (+n > 0 && !force) { console.log('People already exist. Use --force to wipe and reseed (dev only).'); process.exit(0); }
if (force) await db.execute(sql`truncate people, sessions, day_logs, leaves, weeks, hr_records, app_config, audit_log, push_subs, reminder_log restart identity cascade; alter sequence emp_no_seq restart with 1`);

const today = keyOf(new Date());
const settings = { ...DEFAULTS, goLive: addD(today, -21), holidays: [], gamesdays: [] };
await db.insert(t.appConfig).values({ key: 'settings', value: settings });

const pw = await hashPassword('muster-dev-1');
// Demo copy of the real roster. Demo emails are <first name>@example.com.
const people = ROSTER.map((r) => ({ ...r, email: r.name.toLowerCase() + '@example.com' }));
const ids: number[] = [];
for (const r of people) {
  const [{ v }] = (await db.execute<{ v: string }>(sql`select nextval('emp_no_seq')::text as v`)).rows;
  const [p] = await db.insert(t.people).values({
    empNo: 'ZET-' + v.padStart(3, '0'), fullName: r.name, role: r.role, email: r.email, type: r.type, metrics: r.metrics ?? defaultMetrics(r.role),
    isHr: !!r.hr || !!r.superadmin, isSuperadmin: !!r.superadmin, status: 'active',
    passwordHash: r.name === 'Chitra' ? null : pw, guideSeen: true,
  }).returning();
  ids.push(p.id);
}
// one pending self-registration
const [{ v }] = (await db.execute<{ v: string }>(sql`select nextval('emp_no_seq')::text as v`)).rows;
await db.insert(t.people).values({ empNo: 'ZET-' + v.padStart(3, '0'), fullName: 'Riya Kapoor', email: 'riya.kapoor@example.com', passwordHash: pw, status: 'pending' });

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const tasks = ['Call BFSI employers from the Mumbai list', 'Follow up with TPO on demo date', 'Send MoU draft', 'Update CRM sheet', 'Design landing page hero', 'Write LinkedIn post', 'Model evaluation run', 'Fix data pipeline bug'];

for (let i = 0; i < ids.length; i++) {
  const pid = ids[i], { type } = people[i], metrics = people[i].metrics ?? [];
  for (let back = 14; back >= 0; back--) {
    const k = addD(today, -back);
    if ([0, 6].includes(dow(k))) continue;
    if (people[i].name === 'Puneet' && back === 3) continue; // a demo absence
    if (people[i].name === 'Shama' && back === 5) { await db.insert(t.leaves).values({ personId: pid, date: k, kind: 'casual', reason: 'Family function', appliedAt: isoAt(addD(k, -4), '11:00'), status: 'approved' }); continue; }
    const mode: t.Mode = type === 'remote' ? 'remote' : back % 3 === 0 ? 'wfh' : 'office';
    const inM = rnd(9 * 60 + 35, 10 * 60 + (people[i].name === 'Krish' ? 40 : 18));
    const ci = isoAt(k, hm(inM));
    const done = back > 0;
    await db.insert(t.dayLogs).values({
      personId: pid, date: k, mode, checkInAt: ci, checkInSrc: 'server',
      checkOutAt: done ? isoAt(k, hm(rnd(18 * 60, 19 * 60 + 10))) : null, checkOutSrc: done ? 'server' : null,
      ...computeLate(settings, { id: pid, type }, k, mode, ci),
      plan: [0, 1, 2].map((j) => ({ id: `${k}-${j}`, text: tasks[(i + j + back) % tasks.length], status: (done || j === 0 ? 'done' : j === 1 ? 'doing' : 'todo') as t.TaskStatus })),
      eod: done && back !== 2 ? 'Finished the planned tasks; follow-ups carry to tomorrow.' : null,
      metrics: Object.fromEntries(metrics.map((m) => [m, rnd(0, 12)])),
      blocker: !done && people[i].name === 'Krish' ? { text: 'Need the updated demo deck from Shama' } : null,
    });
  }
  await db.insert(t.weeks).values({ personId: pid, monday: monday(today), targets: metrics.slice(0, 2).map((m, j) => ({ id: 't' + j, text: `Weekly ${m}`, metric: m, goal: 40, done: 0 })), seniorStatus: people[i].name === 'Krish' ? 'push' : null, seniorComment: people[i].name === 'Krish' ? 'Good call volume. Push for demo conversions.' : null });
}
await db.insert(t.leaves).values({ personId: ids[people.findIndex((x) => x.name === 'Krish')], date: [addD(today, 6), addD(today, 7), addD(today, 8)].find((k) => ![0, 6].includes(dow(k)))!, kind: 'casual', reason: 'Wedding', appliedAt: new Date().toISOString(), status: 'pending' });

console.log(`Seeded ${people.length} people + 1 pending. Password for all: muster-dev-1. Superadmins: suketu@example.com, harsh@example.com; HR also krish@example.com`);
await pool.end();
