/**
 * Load the real team (scripts/roster-data.ts) into the database. Safe on production:
 * it only inserts people whose first name isn't there yet, never deletes or overwrites.
 *   DATABASE_URL=<neon url> npm run roster
 *   npm run roster -- --email Suketu=founder@zetheta.com --email Harsh=harsh@zetheta.com
 * Emails can also be added later in Settings → Team.
 *   npm run roster -- --issue-passwords Suketu,Harsh   (one-time passwords for people with no login yet;
 *   they sign in with their employee code and must choose a new password)
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as t from '../lib/db/schema';
import { ROSTER } from './roster-data';
import { defaultMetrics } from '../lib/constants';
import { fmtNo, shortName } from '../lib/names';
import { hashPassword, tempPassword } from '../lib/crypto';
import { DEFAULTS } from '../lib/settings';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: t });

const emails = new Map<string, string>();
process.argv.forEach((a, i) => {
  if (process.argv[i - 1] !== '--email') return;
  const [n, e] = a.split('=');
  if (n && e) emails.set(n.trim().toLowerCase(), e.trim().toLowerCase());
});

const existing = await db.select().from(t.people);
const have = new Set(existing.map((p) => shortName(p.fullName).toLowerCase()));
const out: string[][] = [];
for (const r of ROSTER) {
  const key = r.name.toLowerCase();
  const email = emails.get(key) || null;
  if (have.has(key)) {
    const p = existing.find((x) => shortName(x.fullName).toLowerCase() === key)!;
    if (email && !p.email) await db.update(t.people).set({ email }).where(eq(t.people.id, p.id));
    out.push([p.empNo, r.name, r.superadmin ? 'Superadmin' : r.hr ? 'HR' : 'Employee', 'already there' + (email && !p.email ? ', email set' : '')]);
    continue;
  }
  const empNo = fmtNo(+(await db.execute<{ n: string }>(sql`select nextval('emp_no_seq')::text as n`)).rows[0].n);
  await db.insert(t.people).values({
    empNo, fullName: r.name, role: r.role, type: r.type, metrics: r.metrics ?? defaultMetrics(r.role),
    isHr: !!r.hr || !!r.superadmin, isSuperadmin: !!r.superadmin, status: 'active', email,
  });
  out.push([empNo, r.name, r.superadmin ? 'Superadmin' : r.hr ? 'HR' : 'Employee', 'added' + (email ? ` (${email})` : '')]);
}
// Make sure the singleton config rows exist.
await db.insert(t.appConfig).values({ key: 'settings', value: DEFAULTS }).onConflictDoNothing();
await db.insert(t.appConfig).values({ key: 'compliance', value: {} }).onConflictDoNothing();

const issue = (process.argv[process.argv.indexOf('--issue-passwords') + 1] || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const temps: { code: string; name: string; password: string }[] = [];
if (process.argv.includes('--issue-passwords')) {
  for (const p of await db.select().from(t.people)) {
    if (!issue.includes(shortName(p.fullName).toLowerCase())) continue;
    if (p.passwordHash) { temps.push({ code: p.empNo, name: p.fullName, password: '(already has a login; not changed)' }); continue; }
    const pw = tempPassword();
    await db.update(t.people).set({ passwordHash: await hashPassword(pw), mustChangePassword: true }).where(eq(t.people.id, p.id));
    temps.push({ code: p.empNo, name: p.fullName, password: pw });
  }
}
console.table(out.map(([code, name, access, note]) => ({ code, name, access, note })));
console.log('\nHand each employee their code: they choose “First time here?”, enter their email, name and code, and are linked.');
console.log('HR and superadmins link by email only: set it with --email Name=address, in Settings, or list it in HR_EMAILS.');
if (temps.length) { console.log('\nOne-time passwords (sign in with the employee code; a new password is required at first sign-in):'); console.table(temps); }
await pool.end();
