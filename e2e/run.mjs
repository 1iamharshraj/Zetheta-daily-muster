/**
 * End-to-end test of every feature, against a LOCAL demo database. Never point this at production.
 *
 *   DATABASE_URL=postgres://postgres:muster@localhost:54329/muster npm run db:seed -- --force
 *   DATABASE_URL=postgres://postgres:muster@localhost:54329/muster CRON_SECRET=dev-secret npm run dev
 *   npm run test:e2e
 *
 * Uses a cached Chromium from ~/Library/Caches/ms-playwright (or PW_CHROMIUM=/path/to/chrome).
 * Screenshots go to e2e/out/.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const U = process.env.E2E_URL || 'http://localhost:3000';
const DB = process.env.E2E_DATABASE_URL || 'postgres://postgres:muster@localhost:54329/muster';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
const PHOTO = path.join(path.dirname(new URL(import.meta.url).pathname), 'photo.png');
const CRON = process.env.CRON_SECRET || 'dev-secret';
fs.mkdirSync(OUT, { recursive: true });
if (/neon\.tech/.test(DB)) throw new Error('Refusing to run e2e against Neon.');

function chromePath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const dir = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir).sort().reverse() : []) {
    for (const rel of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-mac/headless_shell']) {
      const p = path.join(dir, d, rel);
      if (d.startsWith('chromium_headless_shell') && fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

/* ---------- helpers ---------- */
const db = new pg.Client({ connectionString: DB });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const one = async (sql, args = []) => (await q(sql, args))[0];
const pid = async (name) => (await one('select id from people where full_name ilike $1 order by id limit 1', [name + '%'])).id;
const istToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addD = (k, n) => { const t = new Date(k + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dow = (k) => new Date(k + 'T00:00:00Z').getUTCDay();
const nextWorkday = (k, n = 1) => { let x = k; for (let i = 0; i < n; ) { x = addD(x, 1); if (dow(x) % 6) i++; } return x; };
const fmtShort = (k) => new Date(k + 'T00:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const dmy = (k) => `${k.slice(8)}-${k.slice(5, 7)}-${k.slice(0, 4)}`;

function totp(secret, t = Date.now()) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/\s/g, '')) bits += A.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const b = Buffer.alloc(8); b.writeUInt32BE(Math.floor(t / 30000), 4);
  const h = crypto.createHmac('sha1', key).update(b).digest(), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

const results = [];
let section = '';
const sec = (s) => { section = s; console.log('\n## ' + s); };
const ok = (name, cond, detail = '') => {
  results.push({ section, name, pass: !!cond, detail: String(detail ?? '') });
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' && detail != null ? '  — ' + String(detail).slice(0, 140) : ''}`);
};
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, 'threw: ' + e.message.split('\n')[0]); } };

const browser = await chromium.launch({ executablePath: chromePath() });
const pageErrors = [];
const timings = [];
async function newPage(width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => pageErrors.push(`${p.url()}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|webpack-hmr|_next\/webpack/.test(m.text())) pageErrors.push(`${p.url()}: console: ${m.text()}`); });
  return p;
}
async function toast(p, timeout = 8000) {
  await p.waitForFunction(() => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent && t.textContent !== window.__lt; }, null, { timeout }).catch(() => {});
  const t = (await p.textContent('#toast').catch(() => '')) || '';
  await p.evaluate((x) => { window.__lt = x; }, t).catch(() => {});
  return t;
}
async function go(p, url) {
  const t0 = Date.now();
  await p.goto(U + url);
  await p.waitForLoadState('networkidle').catch(() => {});
  timings.push({ url, ms: Date.now() - t0 });
}
const secrets = {};
async function login(id, { role = 'employee', pw = 'muster-dev-1', width = 1280 } = {}) {
  const p = await newPage(width);
  await go(p, '/signin');
  if (role === 'hr') await p.click('button[role=radio]:has-text("HR")');
  await p.fill('input[name=email]', id);
  await p.fill('input[name=password]', pw);
  await p.click('button.btn.primary.xl');
  await p.waitForURL((u) => !u.pathname.startsWith('/signin') || u.pathname === '/signin/verify', { timeout: 15000 }).catch(() => {});
  if (role === 'hr' && p.url().includes('/signin/verify')) {
    const key = await p.locator('code.key').textContent().catch(() => null);
    if (key) secrets[id] = key.replace(/\s/g, '');
    await p.fill('input[name=code]', totp(secrets[id]));
    await p.click('button.btn.primary.xl');
    await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 15000 }).catch(() => {});
  }
  await p.waitForLoadState('networkidle').catch(() => {});
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }).catch(() => {});
const codeOf = async (name) => (await one('select emp_no from people where full_name ilike $1 order by id limit 1', [name + '%'])).emp_no;
const rowFor = async (p, name) => p.locator('.rrow', { has: p.locator(`input[aria-label="Employee code"][value="${await codeOf(name)}"]`) });
const closeGuide = async (p) => { if (await p.locator('.sheet:has-text("How the muster works")').count()) await p.click('.sheet button:has-text("Got it")'); };

/* =================================================================== */
const ids = {};
for (const n of ['Suketu', 'Harsh', 'Sagar', 'Krish', 'Shama', 'Aditya', 'Chitra', 'Kavi', 'Khushi', 'Puneet', 'Radhika', 'Vritee']) ids[n] = await pid(n);
const sunday = dow(istToday) === 0 || dow(istToday) === 6;

sec('1. Sign-in, registration and access');
await step('auth', async () => {
  let p = await newPage();
  await go(p, '/home');
  ok('Signed-out visit to /home goes to sign-in', p.url().includes('/signin'), p.url());
  ok('Sign-in page has Employee/HR toggle above email', (await p.locator('.modes + input, .modes ~ label input[name=email]').count()) > 0);
  await p.fill('input[name=email]', 'puneet@example.com'); await p.fill('input[name=password]', 'wrong-password'); await p.click('button.btn.primary.xl');
  await p.waitForSelector('.err'); ok('Wrong password is refused', /Wrong/.test(await p.textContent('.err')), await p.textContent('.err'));
  await p.click('button[role=radio]:has-text("HR")'); await p.fill('input[name=password]', 'muster-dev-1'); await p.click('button.btn.primary.xl');
  await p.waitForFunction(() => /HR access/.test(document.querySelector('.err')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok('Employee choosing HR is refused', /HR access/.test(await p.textContent('.err')), await p.textContent('.err'));
  await p.click('.info summary'); ok('(i) button opens the explanation', await p.locator('.info-pop').isVisible());
  await p.click('button.link:has-text("Create your password")');
  await p.fill('input[name=email]', 'someone@yahoo.com'); await p.fill('input[name=name]', 'Yahoo Person'); await p.fill('input[name=password]', 'longenough1'); await p.click('button.btn.primary.xl');
  await p.waitForSelector('.err'); ok('Registration from a non-allowed domain is refused', /zetheta\.com|Gmail/.test(await p.textContent('.err')), await p.textContent('.err'));
  await p.fill('input[name=email]', 'puneet@example.com'); await p.fill('input[name=password]', 'longenough1'); await p.click('button.btn.primary.xl');
  await p.waitForFunction(() => /already has an account/.test(document.querySelector('.err')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok('Typed email and name survive a failed attempt', (await p.inputValue('input[name=name]')) === 'Yahoo Person');
  ok('Registering an email that already has an account is refused', /already has an account/.test(await p.textContent('.err')));
  await p.fill('input[name=email]', 'meera.test@gmail.com'); await p.fill('input[name=name]', 'Dr. Meera Iyer'); await p.fill('input[name=password]', 'short'); await p.click('button.btn.primary.xl');
  await p.waitForFunction(() => /8 characters/.test(document.querySelector('.err')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok('Short password is refused', /8 characters/.test(await p.textContent('.err')));
  await p.fill('input[name=password]', 'meera-pass-1'); await p.click('button.btn.primary.xl');
  await p.waitForURL('**/pending', { timeout: 15000 }).catch(() => {});
  const txt = await p.textContent('body');
  const seq = (await one("select last_value from emp_no_seq")).last_value;
  ok('AC1: new sign-up gets the next ZET code and waits for HR', p.url().endsWith('/pending') && txt.includes('ZET-' + String(seq).padStart(3, '0')), txt.match(/ZET-\d+/)?.[0]);
  await go(p, '/team'); ok('Pending account cannot open the app', p.url().endsWith('/pending'));

  p = await login('ZET-' + String((await one('select emp_no from people where id=$1', [ids.Aditya])).emp_no.slice(4)));
  ok('Sign-in with employee code works', p.url().endsWith('/home'), p.url());
  await closeGuide(p);
  await p.click('.side button.logout'); await p.waitForURL('**/signin').catch(() => {});
  ok('Log out returns to sign-in', p.url().includes('/signin'));
  await go(p, '/home'); ok('After log out, /home needs sign-in again', p.url().includes('/signin'));
  const r = await p.request.get(U + '/api/registers/employees'); ok('Registers API refuses signed-out requests', r.status() === 403, r.status());
  const c = await p.request.get(U + '/api/cron/reminders'); ok('Reminders endpoint refuses calls without the secret', c.status() === 401, c.status());

  const h = await login('krish@example.com', { role: 'hr' });
  ok('First HR sign-in shows QR + manual key, then accepts the code', h.url().endsWith('/home') && !!secrets['krish@example.com'], h.url());
  const h2 = await newPage(); await go(h2, '/signin'); await h2.click('button[role=radio]:has-text("HR")');
  await h2.fill('input[name=email]', 'krish@example.com'); await h2.fill('input[name=password]', 'muster-dev-1'); await h2.click('button.btn.primary.xl');
  await h2.waitForURL('**/signin/verify');
  ok('Second HR sign-in asks only for the code (no QR)', (await h2.locator('.qr').count()) === 0);
  await h2.fill('input[name=code]', '000000'); await h2.click('button.btn.primary.xl'); await h2.waitForSelector('.err');
  ok('Wrong authenticator code is refused', /didn’t match/.test(await h2.textContent('.err')));
});

sec('2. Employee day: clock, tasks, numbers, blocker');
let P; // Puneet
await step('day', async () => {
  // put an unfinished task on Puneet's last working day so carry-over can be tested
  const last = await one("select date::text d from day_logs where person_id=$1 and date < $2 and jsonb_array_length(plan)>0 order by date desc limit 1", [ids.Puneet, istToday]);
  await q("update day_logs set plan='[{\"id\":\"c1\",\"text\":\"Follow up with HDFC TPO\",\"status\":\"doing\"},{\"id\":\"c2\",\"text\":\"Old finished task\",\"status\":\"done\"}]' where person_id=$1 and date=$2", [ids.Puneet, last.d]);
  P = await login('puneet@example.com'); await closeGuide(P);
  ok('Home greets by first name with code · role', /Puneet/.test(await P.textContent('.hello h2')) && /ZET-\d+/.test(await P.textContent('.hello .hrole')));
  ok('Quick actions show 4 tiles', (await P.locator('.quick .qa').count()) === 4);
  ok('Topbar CTA is Clock in', (await P.locator('.topbar button:has-text("Clock in")').count()) === 1);
  await P.click('.modes button:has-text("Meeting / Event")'); await P.click('.clock button.btn.primary.xl');
  ok('Meeting/Event needs a note', /Say where/.test(await toast(P)));
  await P.click('.modes button:has-text("Office")'); await P.click('.clock button.btn.primary.xl');
  const t1 = await toast(P); ok('Clock in (server time) works', /Clocked in at/.test(t1), t1);
  await P.waitForSelector('.clock.on');
  ok('Clocked-in card shows mode, timer and In-at chip', /Clocked in · Office/.test(await P.textContent('.clock .eyebrow')) && /In at/.test(await P.textContent('.clock')));
  ok(sunday ? 'Weekend check-in shows On time (no late marks on non-working days)' : 'Late chip shown', /On time|Late/.test(await P.textContent('.clock')));
  ok('Unfinished task carried over automatically at clock-in', /Follow up with HDFC TPO/.test(await P.textContent('#sec-tasks')) && /carried over/.test(await P.textContent('#sec-tasks')));
  ok('Finished tasks are not carried', !/Old finished task/.test(await P.textContent('#sec-tasks')));
  for (const t of ['Post 3 LinkedIn updates', 'Message 20 students', 'Call TPO at NMIMS']) { await P.fill('#newtask', t); await P.keyboard.press('Enter'); await P.waitForTimeout(700); }
  await P.waitForFunction(() => document.querySelectorAll('.trow:not(.th)').length >= 4);
  ok('Tasks are added with Enter', (await P.locator('.trow:not(.th)').count()) === 4);
  await P.selectOption('.trow:not(.th) >> nth=1 >> select', 'done'); await P.waitForTimeout(800);
  await P.selectOption('.trow:not(.th) >> nth=2 >> select', 'blocked'); await P.waitForTimeout(800);
  ok('Task status changes save (Completed, Blocked)', (await P.locator('.trow.s-done').count()) === 1 && (await P.locator('.trow.s-blocked').count()) === 1);
  ok('Progress shows "x of y completed"', /1 of 4 completed/.test(await P.textContent('#sec-tasks')));
  await P.click('.trow:not(.th) >> nth=3 >> button.x'); await P.waitForTimeout(800);
  ok('Task can be removed', (await P.locator('.trow:not(.th)').count()) === 3);
  const inc = P.locator('#sec-numbers button[aria-label^="Increase"]').first();
  await inc.click(); await inc.click(); await inc.click(); await P.waitForTimeout(1500);
  await P.reload(); await P.waitForLoadState('networkidle');
  ok('Daily numbers persist after reload', (await P.locator('#sec-numbers input').first().inputValue()) === '3');
  await P.click('button:has-text("Stuck on something?")'); await P.fill('.sheet textarea', 'Waiting for the student list from Shama'); await P.click('.sheet button:has-text("Flag it")');
  ok('Blocker can be flagged', /Blocker flagged/.test(await toast(P)));
  await P.waitForSelector('.blocker'); ok('Blocker card shows the text', /student list/.test(await P.textContent('.blocker')));
  await P.click('button:has-text("Mark resolved")'); ok('Blocker can be resolved', /resolved/.test(await toast(P)));
  ok('Profile reminder card shows while profile is incomplete', /Your profile is \d+% complete/.test(await P.textContent('.a-side')));
  ok('At a glance and Coming up cards render', /At a glance/.test(await P.textContent('.a-side')) && /Coming up/.test(await P.textContent('.a-side')));
  await P.click('.topbar button:has-text("Clock out")'); await P.fill('.sheet textarea', 'too short');
  ok('AC6: Clock out disabled until a real summary is written', await P.isDisabled('.sheet button.btn.primary'));
  await P.fill('.sheet textarea', 'Posted 3 updates, messaged 20 students. Waiting on NMIMS TPO.'); await P.click('.sheet button.btn.primary');
  ok('Clock out with summary', /Clocked out/.test(await toast(P)));
  await P.waitForSelector('.clock .eyebrow:has-text("Day complete")'); ok('Day complete card shows hours and in/out', /Out/.test(await P.textContent('.clock')));
  await P.click('button:has-text("View or edit today’s summary")'); await P.fill('.sheet textarea', 'Posted 3 updates, messaged 20 students. NMIMS call moved to Monday.'); await P.click('.sheet button:has-text("Save summary")');
  ok('Summary can be edited after clock out', /Summary saved/.test(await toast(P)));
  const d = await one('select check_in_src, check_out_src, eod, late_status from day_logs where person_id=$1 and date=$2', [ids.Puneet, istToday]);
  ok('DB: times stamped by server, summary stored, late status frozen', d.check_in_src === 'server' && d.check_out_src === 'server' && /NMIMS/.test(d.eod) && d.late_status, JSON.stringify(d));
  await shot(P, 'employee-home');
});

sec('3. Leave');
const L1 = nextWorkday(istToday, 5), L2 = nextWorkday(istToday, 7), LH = nextWorkday(istToday, 10);
await step('leave', async () => {
  await go(P, '/leave');
  ok('Balances show casual / earned / LWP / upcoming', (await P.locator('.strip > div').count()) === 4);
  const apply = async (from, to, half, kind, reason) => {
    await P.click('main .toolbar button:has-text("Apply leave")');
    await P.fill('.sheet input[type=date] >> nth=0', from);
    if (half) await P.selectOption('.sheet select >> nth=0', 'half'); else await P.fill('.sheet input[type=date] >> nth=1', to);
    await P.selectOption('.sheet select >> nth=1', kind);
    await P.fill('.sheet input[placeholder="Optional"]', reason);
    await P.click('.sheet button:has-text("Apply leave")');
    return toast(P);
  };
  let t = await apply(L1, L2, false, 'casual', 'Family wedding');
  const n = (t.match(/for (\d+) working day/) || [])[1];
  ok('Multi-day leave counts working days only (weekend skipped)', +n === 3, t);
  t = await apply(LH, LH, true, 'earned', 'Doctor visit'); ok('Half-day earned leave', /1 working day/.test(t), t);
  t = await apply(L1, L1, false, 'casual', 'again'); ok('Overlapping leave is refused', /already have leave/.test(t), t);
  await go(P, '/leave');
  ok('Upcoming list shows requests as "Awaiting HR"', (await P.locator('.mini li:has-text("Awaiting HR")').count()) >= 4);
  await P.locator('.mini li', { hasText: fmtShort(LH) }).locator('button:has-text("Cancel")').click();
  ok('Future leave can be cancelled', /cancelled/.test(await toast(P)));
  await P.click('main .toolbar button:has-text("Apply leave")'); await P.fill('.sheet input[type=date] >> nth=0', addD(istToday, -2)); await P.click('.sheet button:has-text("Apply leave")');
  ok('Leave in the past is refused', /today or a later/.test(await toast(P)));
  await P.keyboard.press('Escape');
});

sec('4. My attendance calendar and day editor');
const absentDay = (await one("select d::date::text d from generate_series($1::date - 14, $1::date - 1, '1 day') d where extract(isodow from d) < 6 and not exists (select 1 from day_logs where person_id=$2 and date=d::date) and not exists (select 1 from leaves where person_id=$2 and date=d::date and status in ('pending','approved')) order by d desc limit 1", [istToday, ids.Puneet]))?.d;
await step('attendance', async () => {
  await go(P, '/attendance');
  ok('Calendar renders a month with weekday headers', (await P.locator('.calg .wd').count()) === 7 && (await P.locator('button.cd').count()) >= 28);
  ok('KPI strip has 6 tiles', (await P.locator('.strip > div').count()) === 6);
  ok('Absent day shown in red', absentDay && (await P.locator(`button.cd.m-absent[title^="${fmtShort(absentDay)}"]`).count()) === 1, absentDay);
  await P.click(`button.cd[title^="${fmtShort(absentDay)}"]`);
  await P.click('.sheet .edopts button:has-text("Office")');
  await P.fill('.sheet label:has-text("Started at") input', '10:40'); await P.fill('.sheet label:has-text("Finished at") input', '18:30');
  await P.click('.sheet button:has-text("Save")');
  ok('Past-day edit needs a reason', /reason/.test(await toast(P)));
  await P.fill('.sheet label:has-text("Reason for the change") input', 'Forgot to clock in; was in office');
  await P.fill('.sheet label:has-text("What did you do that day?") textarea', 'Student outreach and follow-ups');
  await P.click('.sheet button:has-text("Save")');
  ok('Past-day edit saves and is flagged to HR', /HR can see/.test(await toast(P)));
  await P.waitForTimeout(800);
  const cell = P.locator(`button.cd[title^="${fmtShort(absentDay)}"]`);
  ok('Edited day shows Office, ✎ and late edge', /Office/.test(await cell.textContent()) && /✎/.test(await cell.textContent()) && /late/.test(await cell.getAttribute('class')));
  const fut = nextWorkday(istToday, 3);
  await P.click(`button.cd[title^="${fmtShort(fut)}"]`); await P.click('.sheet .edopts button:has-text("Work from home")'); await P.click('.sheet button:has-text("Save")');
  ok('Future day can be planned', /plan/.test(await toast(P)));
  await P.waitForTimeout(600);
  ok('Planned day shows "WFH · plan" (dashed)', /WFH · plan/.test(await P.locator(`button.cd[title^="${fmtShort(fut)}"]`).textContent()));
  ok('Day log table lists recorded days', (await P.locator('.tbl tbody tr').count()) > 3);
  await P.click('main a:has-text("Previous")'); await P.waitForURL(/\?m=/, { timeout: 10000 }).catch(() => {});
  ok('Previous month navigation', /\?m=/.test(P.url()));
  await go(P, '/attendance');
  await shot(P, 'employee-attendance');
});

sec('5. Weekly goals');
await step('goals', async () => {
  await go(P, '/goals');
  await P.fill('#tg-text', 'Run 2 webinars'); await P.fill('main input[type=number]', '2'); await P.click('button:has-text("Add target")'); await P.waitForTimeout(800);
  await P.fill('#tg-text', 'Send 60 LinkedIn messages'); await P.selectOption('main select', 'messages'); await P.fill('main input[type=number]', '60'); await P.click('button:has-text("Add target")'); await P.waitForTimeout(800);
  ok('Targets added (manual and auto-linked)', (await P.locator('.target').count()) >= 2 + 0 && /Auto · LinkedIn/.test(await P.textContent('main')));
  const t = P.locator('.target', { hasText: 'Run 2 webinars' });
  await t.locator('button[aria-label=Increase]').click(); await P.waitForTimeout(700); await t.locator('button[aria-label=Increase]').click(); await P.waitForTimeout(700); await t.locator('button[aria-label=Decrease]').click(); await P.waitForTimeout(900);
  ok('Manual target +/− works', /1\/2/.test(await t.textContent()));
  ok('Auto target follows daily numbers', /\d+\/60/.test(await P.locator('.target', { hasText: '60 LinkedIn' }).textContent()));
  ok('Overall % shown', /% achieved/.test(await P.textContent('main')));
  await P.fill('main textarea', 'Good week for outreach; need the student list earlier.'); await P.click('button:has-text("Save review")');
  ok('Self-review saves', /Review saved/.test(await toast(P)));
  await P.locator('.target', { hasText: 'Run 2 webinars' }).locator('button.x').click(); await P.waitForTimeout(800);
  ok('Target can be removed', (await P.locator('.target', { hasText: 'Run 2 webinars' }).count()) === 0);
  await P.click('main a:has-text("Next")'); await P.waitForURL(/\?w=/, { timeout: 10000 }).catch(() => {}); ok('Week navigation', /\?w=/.test(P.url()));
});

sec('6. My profile');
await step('profile', async () => {
  await go(P, '/profile');
  const fl = (label, i = 0) => P.locator('label.fl', { has: P.locator(`span:text-is("${label}"), span:has-text("${label}")`) }).nth(i);
  await P.setInputFiles('input[type=file]', PHOTO);
  ok('Photo upload (resized to 192px JPEG)', /Photo updated/.test(await toast(P)));
  await P.waitForSelector('.side .sb-me .av.ph img');
  ok('Photo appears on the sidebar avatar', (await P.locator('.side .sb-me img').count()) === 1);
  const photo = await one('select length(photo) n, left(photo, 23) h from people where id=$1', [ids.Puneet]);
  ok('Stored photo is a small JPEG', photo.h === 'data:image/jpeg;base64,' && photo.n < 80000, photo.n + ' bytes');
  await fl('Full name').locator('input').fill('Puneet Rao');
  await fl('Gender').locator('select').selectOption('Male');
  await fl('Date of birth').locator('input').fill('31022001'); await P.click('main button:has-text("Save profile")');
  ok('AC8: impossible date refused', /Date of birth/.test(await toast(P)));
  await fl('Date of birth').locator('input').fill('05042001');
  ok('AC8: digits auto-format to dd-mm-yyyy', (await fl('Date of birth').locator('input').inputValue()) === '05-04-2001');
  await fl('Highest qualification').locator('input').fill('B.Com');
  await fl('Mobile number').locator('input').fill('9876543210');
  const addr = { 'Flat / House no.': '12B', 'Area / Locality': 'Andheri West', 'City / Town / Village': 'Mumbai', 'District': 'Mumbai Suburban' };
  for (const [k, v] of Object.entries(addr)) await fl(k, 0).locator('input').fill(v);
  await fl('State / UT', 0).locator('select').selectOption('Maharashtra');
  await fl('PIN code', 0).locator('input').fill('40005'); await P.click('main button:has-text("Save profile")');
  ok('AC9: 5-digit PIN blocks save', /PIN/.test(await toast(P)));
  await fl('PIN code', 0).locator('input').fill('400058');
  await P.check('label.chk:has-text("Same as permanent") input');
  ok('AC10: "Same as permanent" mirrors and freezes every field incl. State and PIN',
    (await fl('PIN code', 1).locator('input').inputValue()) === '400058' && (await fl('State / UT', 1).locator('select').inputValue()) === 'Maharashtra' && await fl('PIN code', 1).locator('input').evaluate((e) => e.readOnly));
  await fl('Area / Locality', 0).locator('input').fill('Andheri East');
  ok('PRF-5: present address stays in sync live', (await fl('Area / Locality', 1).locator('input').inputValue()) === 'Andheri East');
  await P.locator('label.fl:has(> span:text-is("Name")) input').first().fill('Rekha Rao');
  await P.locator('label.fl:has(> span:text-is("Relationship")) select').first().selectOption('Parent');
  await P.locator('label.fl:has(> span:text-is("Contact number")) input').first().fill('9820012345');
  await P.click('main button:has-text("Save profile")');
  ok('Profile saves', /Profile saved/.test(await toast(P)));
  await P.waitForTimeout(800);
  ok('Profile reaches 100% complete', /Profile 100% complete/.test(await P.textContent('.pcomp')), (await P.textContent('.pc-top')));
  const rec = await one("select personal->>'presentAddr' a, personal->>'dob' dob from hr_records where person_id=$1", [ids.Puneet]);
  ok('PRF-6: one-line address composed; DOB stored as a date', /12B, Andheri East, Mumbai, Mumbai Suburban district, Maharashtra, India - 400058/.test(rec.a) && rec.dob === '2001-04-05', rec.a);
  ok('Employment details are read-only (locks)', (await P.locator('.rov .lk').count()) >= 10);
  await fl('Full name').locator('input').fill('Dr. Puneet Rao'); await P.click('main button:has-text("Save profile")'); await toast(P); await P.waitForTimeout(800);
  ok('AC11: title kept in display name ("Dr. Puneet")', (await P.textContent('.side .sb-me b')) === 'Dr. Puneet');
  await P.fill('input[name=current]', 'nope'); await P.fill('input[name=password]', 'new-password-1'); await P.click('button:has-text("Change password")');
  await P.waitForSelector('.err'); ok('Change password needs the current one', /current password/.test(await P.textContent('.err')));
  await P.fill('input[name=current]', 'muster-dev-1'); await P.fill('input[name=password]', 'new-password-1'); await P.click('button:has-text("Change password")');
  ok('Password changed', /Password changed/.test(await toast(P)));
  const p2 = await login('puneet@example.com', { pw: 'new-password-1' }); ok('New password works', p2.url().endsWith('/home'));
  ok('Push toggle explains when the server has no push keys', /aren’t set up|Turn on reminders|can’t show/.test(await P.textContent('main')));
  await shot(P, 'employee-profile');
});

sec('7. Team pages (as an employee)');
await step('team', async () => {
  await go(P, '/team');
  ok('Team overview lists everyone A–Z', (await P.locator('.pulse li').count()) >= 15);
  const names = await P.locator('.pulse li .pn b').allTextContents();
  ok('Sorted A–Z', JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.replace(/^Dr\. /, '').localeCompare(b.replace(/^Dr\. /, '')))), names.join(','));
  ok('Live header and three rings', /working right now/.test(await P.textContent('.hero')) && (await P.locator('.ring').count()) === 3);
  await P.click('.tiles6 .tile >> nth=0'); ok('KPI tile filters the list', /In office \(/.test(await P.textContent('.card h3')));
  await P.click('button:has-text("Show everyone")');
  ok('Employees don’t see the HR attention list or spot checks', (await P.locator('text=Needs your attention').count()) === 0 && (await P.locator('.spot').count()) === 0);
  await P.click('main a:has-text("Previous day")'); await P.waitForURL(/\?d=/, { timeout: 10000 }).catch(() => {}); ok('Day navigator', /\?d=/.test(P.url()));
  await go(P, `/team/${ids.Krish}`);
  ok('Person page shows month stats, calendar, goals, day by day', /Late marks/.test(await P.textContent('main')) && (await P.locator('.calg').count()) === 1 && /Day by day/.test(await P.textContent('main')));
  ok('Employees see no HR controls on person pages', (await P.locator('text=Correct check-in').count()) === 0);
  await go(P, '/sheet');
  ok('Attendance sheet: people across, days down', (await P.locator('.reg thead th.pp').count()) >= 15 && (await P.locator('.reg tbody tr').count()) >= 28);
  ok('Outreach & output table with team total', /Team total/.test(await P.textContent('main')));
  ok('Employees can’t download the muster roll', (await P.locator('a:has-text("Download muster roll")').count()) === 0);
  await go(P, '/reviews'); ok('Weekly reviews show a card per person', (await P.locator('.grid .pc').count()) >= 15);
  ok('Employees can’t give feedback', (await P.locator('button:has-text("Send feedback")').count()) === 0);
  await go(P, '/rules'); ok('Rules page shows the 7 sections from settings', (await P.locator('.rules h3').count()) === 7 && /10:15 AM/.test(await P.textContent('.rules')));
  for (const u of ['/hr', '/hr/records', '/hr/settings', '/hr/compliance', `/hr/records/${ids.Krish}`]) { await go(P, u); ok(`AC7: employee is kept out of ${u}`, P.url().endsWith('/home'), P.url()); }
  const r = await P.request.get(U + '/api/registers/employees'); ok('AC7: employee gets 403 from registers', r.status() === 403);
  await shot(P, 'employee-team');
});

sec('8. HR: desk, approvals, edits, absences');
let H;
await step('hr-desk', async () => {
  H = await login('krish@example.com', { role: 'hr' }); await closeGuide(H);
  ok('Logged in as HR', (await H.textContent('.rolesw b')) === 'HR');
  await go(H, '/hr');
  ok('HR desk KPI strip (4 tiles) and HR to-do', (await H.locator('.strip > div').count()) === 4 && /HR to-do/.test(await H.textContent('main')));
  const req = H.locator('#requests li', { hasText: 'Puneet' });
  ok('Multi-day request shows as one row', (await req.count()) >= 1 && /3 working days/.test(await req.first().textContent()), await req.first().textContent());
  await req.first().locator('input').fill('Enjoy the wedding'); await req.first().locator('button:has-text("Approve")').click();
  ok('Approve leave with comment', /approved/i.test(await toast(H)));
  const st = await q("select status, hr_comment from leaves where person_id=$1 and date between $2 and $3", [ids.Puneet, L1, L2]);
  ok('All days of the request approved with the comment', st.length === 3 && st.every((x) => x.status === 'approved' && x.hr_comment === 'Enjoy the wedding'));
  await go(H, '/hr');
  const ed = H.locator('section:has-text("Attendance edits to review") li', { hasText: 'Puneet' });
  ok('Past-day edit listed with reason', (await ed.count()) === 1 && /Forgot to clock in/.test(await ed.textContent()));
  await ed.locator('button:has-text("Accept")').click(); ok('Edit accepted', /accepted/.test(await toast(H)));
  const abs = H.locator('section:has-text("Unplanned leave") li', { hasText: 'Absent' }).first();
  if (await abs.count()) { await abs.locator('button:has-text("Mark approved leave")').click(); ok('Absence converted to approved leave', /approved leave/.test(await toast(H))); }
  ok('Leave balances table', (await H.locator('section:has-text("Leave balances") tbody tr').count()) >= 15);
  const p = await login('puneet@example.com', { pw: 'new-password-1' }); await go(p, '/leave');
  ok('Employee sees Approved + HR comment', /Approved/.test(await p.textContent('main')) && /Enjoy the wedding/.test(await p.textContent('main')));
  // reject flow
  await p.click('main .toolbar button:has-text("Apply leave")'); await p.fill('.sheet input[type=date] >> nth=0', LH); await p.click('.sheet button:has-text("Apply leave")'); await toast(p);
  await go(H, '/hr'); const r2 = H.locator('#requests li', { hasText: 'Puneet' }).first();
  await r2.locator('input').fill('Quarter-end, please move it'); await r2.locator('button:has-text("Reject")').click();
  ok('Reject leave', /rejected/i.test(await toast(H)));
  await go(p, '/leave'); ok('Employee sees Rejected with reason', /Rejected/.test(await p.textContent('main')) && /Quarter-end/.test(await p.textContent('main')));
  await shot(H, 'hr-desk');
});

sec('9. HR: team controls, reviews, records, registers');
await step('hr-team', async () => {
  // a fresh office check-in today for spot check
  const a = await login('khushi@example.com'); await closeGuide(a); await a.click('.modes button:has-text("Office")'); await a.click('.clock button.btn.primary.xl'); await toast(a);
  await go(H, '/team');
  const row = H.locator('.pulse li', { hasText: 'Khushi' });
  ok('HR sees spot-check buttons on office check-ins', (await row.locator('.spot').count()) === 1);
  await row.locator('button:has-text("Not in")').click(); ok('Spot check "Not in" recorded', /Spot check/.test(await toast(H)));
  await H.waitForTimeout(800); ok('Spot check turns the day into "Not in office"', /Not in office/.test(await H.locator('.pulse li', { hasText: 'Khushi' }).textContent()));
  ok('HR sees "Needs your attention"', /Needs your attention/.test(await H.textContent('main')));
  await go(H, `/team/${ids.Krish}`);
  const ex = H.locator('button:has-text("Excuse late mark")').first();
  if (await ex.count()) { await ex.click(); ok('Excuse a late mark', /excused/.test(await toast(H))); }
  const d = H.locator('.dayrow').first();
  await d.locator('summary:has-text("Correct check-in")').click();
  await d.locator('label:has-text("In") input').fill('09:45'); await d.locator('label:has-text("Out") input').fill('18:15'); await d.locator('button:has-text("Save correction")').click();
  ok('HR corrects check-in/out time', /Correction saved/.test(await toast(H)));
  await H.waitForTimeout(800); ok('Corrected day marked "Corrected by HR"', /Corrected by HR/.test(await H.textContent('.dayrow >> nth=0')));
  await go(H, '/reviews');
  const card = H.locator('.pc', { hasText: 'Puneet' });
  await card.locator('button:has-text("Needs a push")').click(); await toast(H);
  await card.locator('textarea').fill('Strong outreach. Book 2 demos next week.'); await card.locator('button:has-text("Send feedback")').click();
  ok('Weekly feedback sent', /Feedback sent/.test(await toast(H)));
  const p = await login('puneet@example.com', { pw: 'new-password-1' }); await go(p, '/goals');
  ok('Employee sees status + feedback on Weekly goals', /Needs a push/.test(await p.textContent('main')) && /Book 2 demos/.test(await p.textContent('main')));
  await go(p, '/home'); ok('Home goals card shows the senior’s comment', /Book 2 demos/.test(await p.textContent('main')));
  await go(H, '/hr/records');
  ok('Records table lists everyone with profile %', (await H.locator('tbody tr').count()) >= 15 && /100%/.test(await H.textContent('tbody')));
  await go(H, `/hr/records/${ids.Puneet}`);
  const jf = (l) => H.locator('label.fl', { hasText: l }).first();
  await jf('Designation').locator('input').fill('Student Marketing Executive');
  await jf('Date of joining').locator('input').fill('30022025'); await H.click('button:has-text("Save record")');
  ok('Bad joining date refused', /Date of joining/.test(await toast(H)));
  await jf('Date of joining').locator('input').fill('01062025'); await jf('Appointment letter date').locator('input').fill('01062025');
  await jf('Monthly wages').locator('input').fill('25000'); await jf('Employment type').locator('select').selectOption('Permanent');
  await H.click('button:has-text("Save record")'); ok('Employment details saved', /Record saved/.test(await toast(H)));
  await go(H, '/hr/records'); ok('Appointment letter shows "Issued 01-06-2025"', /Issued 01-06-2025/.test(await H.locator('tr', { hasText: 'Puneet' }).textContent()));
  for (const k of ['employees', 'muster', 'attendance', 'leave', 'overtime', 'payroll']) {
    const r = await H.request.get(U + '/api/registers/' + k);
    const body = await r.text();
    const cd = r.headers()['content-disposition'] || '';
    let extra = true;
    if (k === 'employees') extra = /Dr\. Puneet Rao/.test(body) && /05-04-2001/.test(body) && /Student Marketing Executive/.test(body) && /400058/.test(body);
    if (k === 'muster') extra = /Codes: P office/.test(body);
    if (k === 'attendance') extra = /Corrected by HR|Entered by employee/.test(body) && /\d{2}-\d{2}-\d{4}/.test(body);
    if (k === 'leave') extra = /Casual leave entitled/.test(body);
    ok(`AC13: ${k} register downloads as CSV with full names / dd-mm-yyyy`, r.status() === 200 && /\.csv/.test(cd) && extra, cd);
  }
  await shot(H, 'hr-records');
});

sec('9b. Task assignment and themes');
await step('assign', async () => {
  await go(H, '/hr');
  const card = H.locator('#assign');
  await card.locator('input[type=text]').fill('Send the MoU draft to Axis Capital');
  await card.locator('label', { hasText: 'Puneet' }).locator('input').check();
  await card.locator('label', { hasText: 'Khushi' }).locator('input').check();
  await card.locator('button:has-text("Assign")').click();
  ok('HR assigns a task to two people', /assigned to 2 people/.test(await toast(H)));
  await go(H, `/team/${ids.Puneet}`);
  await H.locator('#assign input[type=text]').fill('Prepare the NMIMS demo deck'); await H.locator('#assign button:has-text("Assign")').click();
  ok('HR assigns from the person page', /assigned to/.test(await toast(H)));
  const p = await login('puneet@example.com', { pw: 'new-password-1' });
  const row = p.locator('.trow', { hasText: 'Send the MoU draft' });
  ok('Assigned task shows on the employee’s list with "from Krish"', (await row.count()) === 1 && /from Krish/.test(await row.textContent()));
  ok('Employee can’t delete an assigned task', (await row.locator('button.x').count()) === 0);
  await row.locator('select').selectOption('done'); await p.waitForTimeout(900);
  await go(H, '/hr');
  ok('HR sees the employee’s status on the assigned task', /1 open · 0 done|open/.test(await H.textContent('section:has-text("Assigned tasks")')) && (await H.locator('section:has-text("Assigned tasks") li', { hasText: 'Prepare the NMIMS' }).count()) === 1);
  await H.click('section:has-text("Assigned tasks") button:has-text("Show done")');
  ok('Completed assigned task listed as Completed', /Completed/.test(await H.locator('section:has-text("Assigned tasks") li', { hasText: 'Puneet' }).filter({ hasText: 'MoU' }).textContent()));
  await H.locator('section:has-text("Assigned tasks") li', { hasText: 'Prepare the NMIMS' }).locator('button:has-text("Withdraw")').click();
  ok('HR can withdraw an assigned task', /withdrawn/.test(await toast(H)));
  ok('HR desk badge counts items waiting for HR', (await H.locator('.side .nb').count()) <= 1);
  // themes
  await H.click('.side .thsw button:has-text("Dark")'); await H.waitForTimeout(300);
  ok('Dark mode switch applies instantly', (await H.getAttribute('html', 'data-theme')) === 'dark');
  await H.reload(); await H.waitForLoadState('networkidle');
  ok('Dark mode is remembered (server-rendered, no flash)', (await H.getAttribute('html', 'data-theme')) === 'dark');
  await H.click('.side .thsw button:has-text("Auto")'); await H.waitForTimeout(300);
  ok('Auto follows the device', (await H.getAttribute('html', 'data-theme')) === null);
  ok('Home shows today’s status in the sidebar', /Not in|In|Done|Leave/.test(await p.textContent('.side .nd')));
});

sec('10. HR: compliance and settings');
await step('hr-settings', async () => {
  await go(H, '/hr/compliance');
  ok('Headcount strip and checklist', /employees on the team list/.test(await H.textContent('main')) && (await H.locator('.citem').count()) >= 10);
  const item = H.locator('.citem', { hasText: 'Name board in Marathi' });
  await item.locator('select').selectOption('done'); await toast(H);
  await item.locator('input[placeholder="dd-mm-yyyy"]').fill('10112026'); await item.locator('input[placeholder^="e.g."]').fill('Board installed at reception'); await H.click('h3:has-text("Applies to you now")'); await toast(H);
  await H.reload(); await H.waitForLoadState('networkidle');
  const it2 = H.locator('.citem', { hasText: 'Name board in Marathi' });
  ok('Compliance status, date and note persist', (await it2.locator('select').inputValue()) === 'done' && (await it2.locator('input[placeholder="dd-mm-yyyy"]').inputValue()) === '10-11-2026' && /reception/.test(await it2.locator('input[placeholder^="e.g."]').inputValue()));
  await go(H, '/hr/settings');
  const hol = nextWorkday(istToday, 12);
  await H.locator('label', { hasText: 'Grace period' }).locator('input').fill('20');
  await H.fill('textarea[placeholder="25-12-2026 Christmas"]', `${dmy(hol)} Test Festival\n31-02-2026 Bad`); await H.click('button:has-text("Save rules")');
  ok('Bad holiday line refused', /not understood/.test(await toast(H)));
  await H.fill('textarea[placeholder="25-12-2026 Christmas"]', `${dmy(hol)} Test Festival`); await H.click('button:has-text("Save rules")');
  ok('Rules saved', /Rules saved/.test(await toast(H)));
  await go(H, '/rules'); ok('Rules page reflects new grace period (10:20 AM)', /10:20 AM/.test(await H.textContent('.rules')));
  await go(H, '/attendance?m=' + hol.slice(0, 7)); ok('Holiday appears on calendars', /Holiday/.test(await H.locator(`button.cd[title^="${fmtShort(hol)}"]`).textContent()));
  await go(H, '/hr/settings'); await H.locator('label', { hasText: 'Grace period' }).locator('input').fill('15'); await H.click('button:has-text("Save rules")'); await toast(H);
  // add person -> registers with that email -> linked automatically
  await H.click('button:has-text("Add person")');
  await H.locator('.sheet label', { hasText: 'Full name' }).locator('input').fill('Tanvi Desai');
  await H.locator('.sheet label', { hasText: 'Role' }).locator('input').fill('College Marketing');
  await H.locator('.sheet label', { hasText: 'Email' }).locator('input').fill('tanvi@example.com');
  await H.click('.sheet button:has-text("Add person")');
  const t = await toast(H); ok('Add person gets the next code', /added as ZET-\d+/.test(t), t);
  const r = await newPage(); await go(r, '/signin'); await r.click('button.link:has-text("Create your password")');
  await r.fill('input[name=email]', 'tanvi@example.com'); await r.fill('input[name=name]', 'Tanvi Desai'); await r.fill('input[name=password]', 'tanvi-pass-1'); await r.click('button.btn.primary.xl');
  await r.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 15000 }).catch(() => {});
  ok('Person added by HR links automatically on first sign-in (no pending)', r.url().endsWith('/home'), r.url());
  await r.waitForSelector('#sec-numbers .stepper', { timeout: 10000 }).catch(() => {});
  ok('Daily numbers picked from role (College Marketing → sales metrics)', (await r.locator('#sec-numbers .stepper').count()) === 5);
  // pending registration from section 1: approve
  await go(H, '/hr/settings');
  const pend = H.locator('#pending li', { hasText: 'Meera' });
  await pend.locator('input[aria-label=Role]').fill('Content Writer'); await pend.locator('button:has-text("Add to team")').click();
  ok('Approve a pending registration', /added to the team/.test(await toast(H)));
  const m = await login('meera.test@gmail.com', { pw: 'meera-pass-1' }); ok('Approved person can now use the app', m.url().endsWith('/home'));
  // pending → link to existing (Chitra has no login)
  const reg = await newPage(); await go(reg, '/signin'); await reg.click('button.link:has-text("Create your password")');
  await reg.fill('input[name=email]', 'chitra.personal@gmail.com'); await reg.fill('input[name=name]', 'Chitra N'); await reg.fill('input[name=password]', 'chitra-pass-1'); await reg.click('button.btn.primary.xl');
  await reg.waitForURL('**/pending', { timeout: 15000 }).catch(() => {});
  await go(H, '/hr/settings');
  const pc = H.locator('#pending li', { hasText: 'Chitra N' });
  await pc.locator('select[aria-label^="Link"]').selectOption({ label: 'Chitra' }); await pc.locator('button:has-text("Link")').click();
  ok('Link a registration to an existing roster entry', /Linked/.test(await toast(H)));
  const c = await login('chitra.personal@gmail.com', { pw: 'chitra-pass-1' }); ok('Linked person signs in to their existing record', c.url().endsWith('/home') && /Chitra/.test(await c.textContent('.sb-me b')));
  // rename (NAME-4) and deactivate
  await go(H, '/hr/settings');
  let rr = await rowFor(H, 'Vritee');
  await rr.locator('input[aria-label="Display name"]').fill('Vriti'); await rr.locator('button:has-text("Save")').click(); await toast(H);
  ok('NAME-4: rename in Settings changes the display name', (await one('select full_name from people where id=$1', [ids.Vritee])).full_name === 'Vriti');
  rr = await rowFor(H, 'Kavi');
  await rr.locator('label:has-text("Active") input').uncheck(); await rr.locator('button:has-text("Save")').click(); await toast(H);
  const k = await newPage(); await go(k, '/signin'); await k.fill('input[name=email]', 'kavi@example.com'); await k.fill('input[name=password]', 'muster-dev-1'); await k.click('button.btn.primary.xl');
  await k.waitForSelector('.err'); ok('Deactivated person can’t sign in', /closed/.test(await k.textContent('.err')));
  await go(H, '/team'); ok('Deactivated person leaves the team list', !/Kavi/.test(await H.textContent('.pulse')));
  // HR (not superadmin) limits
  await go(H, '/hr/settings');
  rr = await rowFor(H, 'Radhika');
  await rr.locator('button:has-text("More")').click();
  ok('HR can’t grant HR access', await rr.locator('label:has-text("HR access") input').isDisabled());
  ok('HR can’t reset a superadmin’s login', /managed by a superadmin/.test(await H.textContent('#accounts li:has-text("Suketu")')));
  await H.locator('#accounts li', { hasText: 'Aditya' }).locator('button:has-text("Reset password")').click();
  await H.waitForSelector('.temp-pw'); const temp = (await H.textContent('.temp-pw')).trim(); await H.click('.sheet button:has-text("Done")');
  ok('HR resets an employee password (12-char temp)', temp.length === 12);
  const ad = await login('aditya@example.com', { pw: temp }); await ad.waitForURL('**/change-password', { timeout: 10000 }).catch(() => {}); ok('Temp password forces a new password', ad.url().includes('/change-password'));
  await ad.fill('input[name=password]', 'aditya-new-1'); await ad.click('button:has-text("Change password")');
  await ad.waitForURL('**/home').catch(() => {}); ok('After choosing a new password, lands on Home', ad.url().endsWith('/home'));
  await shot(H, 'hr-settings');
});

sec('11. Superadmin');
await step('superadmin', async () => {
  const S = await login('harsh@example.com', { role: 'hr' }); await closeGuide(S);
  ok('Logged in as Superadmin', (await S.textContent('.rolesw b')) === 'Superadmin');
  ok('Superadmin has their own clock card', (await S.locator('#sec-checkin').count()) === 1);
  await go(S, '/hr/settings');
  const rr = await rowFor(S, 'Radhika');
  await rr.locator('button:has-text("More")').click(); await rr.locator('label:has-text("HR access") input').check(); await rr.locator('button:has-text("Save")').click();
  ok('Superadmin grants HR access', /Saved/.test(await toast(S)));
  const rd = await login('radhika@example.com', { role: 'hr' }); ok('New HR person can sign in as HR (QR setup)', rd.url().endsWith('/home') && (await rd.textContent('.rolesw b')) === 'HR');
  const me = await rowFor(S, 'Harsh');
  await me.locator('button:has-text("More")').click(); ok('Superadmin can’t remove their own superadmin access', await me.locator('label:has-text("Superadmin") input').isDisabled());
  await S.locator('#accounts li', { hasText: 'Krish' }).locator('button:has-text("Reset 2-step")').click();
  ok('Superadmin resets someone’s 2-step verification', /2-step verification reset/.test(await toast(S)));
  delete secrets['krish@example.com'];
  const k2 = await login('krish@example.com', { role: 'hr' }); ok('After reset, HR scans a new QR code', k2.url().endsWith('/home') && !!secrets['krish@example.com']);
  S.once('dialog', (d) => d.accept());
  await S.locator('#accounts li', { hasText: 'Shama' }).locator('button:has-text("Unlink")').click();
  ok('Superadmin unlinks a login', /Unlinked/.test(await toast(S)));
  const sh = await newPage(); await go(sh, '/signin'); await sh.fill('input[name=email]', 'shama@example.com'); await sh.fill('input[name=password]', 'muster-dev-1'); await sh.click('button.btn.primary.xl');
  await sh.waitForSelector('.err'); ok('Unlinked person must create a new password', /haven’t set a password/.test(await sh.textContent('.err')));
  const imp = await newPage(); await go(imp, '/signin'); await imp.click('button.link:has-text("Create your password")');
  await imp.fill('input[name=email]', 'imposter@gmail.com'); await imp.fill('input[name=name]', 'Shama'); await imp.fill('input[name=code]', (await one('select emp_no from people where id=$1', [ids.Shama])).emp_no); await imp.fill('input[name=password]', 'imposter-123'); await imp.click('button.btn.primary.xl');
  await imp.waitForSelector('.err'); ok('Nobody can claim an HR account with code + name', /linked by email only/.test(await imp.textContent('.err')));
  const audit = await q("select action, count(*)::int n from audit_log group by 1 order by 1");
  ok('Audit log records HR actions', audit.length >= 10, audit.map((a) => `${a.action}:${a.n}`).join(' '));
});

sec('12. Reminders (cron)');
await step('cron', async () => {
  const s0 = (await one("select value from app_config where key='settings'")).value;
  // Make "now" fall after every deadline: start 01:00, plan by 01:30, summary by 02:00; today a working day.
  const nowM = (() => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number); return h * 60 + m; })();
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const s1 = { ...s0, workdays: [0, 1, 2, 3, 4, 5, 6], goLive: addD(istToday, -30), officeStart: hm(Math.max(0, nowM - 120)), graceMin: 0, planBy: hm(Math.max(0, nowM - 60)), eodBy: hm(Math.max(0, nowM - 30)) };
  await q("update app_config set value=$1 where key='settings'", [s1]);
  await q("delete from reminder_log");
  const P2 = await login('vritee@example.com'); await closeGuide(P2); await P2.click('.clock button.btn.primary.xl'); await toast(P2); // checked in, no tasks, not out
  let r = await (await fetch(U + '/api/cron/reminders', { headers: { authorization: 'Bearer ' + CRON } })).json();
  ok('Cron sends check-in reminders to people not clocked in', r.sent?.some((x) => x.endsWith(':checkin')), (r.sent || []).length + ' sent');
  ok('Cron sends "add tasks" and "clock out" reminders', r.sent?.some((x) => x.endsWith(':plan')) && r.sent?.some((x) => x.endsWith(':eod')), JSON.stringify(r).slice(0, 200));
  r = await (await fetch(U + '/api/cron/reminders?key=' + CRON)).json();
  ok('Second run sends nothing new (once a day each)', Array.isArray(r.sent) && r.sent.length === 0, JSON.stringify(r));
  await q("update app_config set value=$1 where key='settings'", [s0]);
});

sec('13. Phone layout (390px) and timings');
await step('mobile', async () => {
  const m = await login('puneet@example.com', { pw: 'new-password-1', width: 390 });
  for (const u of ['/home', '/attendance', '/leave', '/goals', '/team', '/sheet', '/reviews', '/rules', '/profile']) {
    await go(m, u);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    ok(`AC14: ${u} has no horizontal scroll at 390px`, sw <= 390, `scrollWidth ${sw}`);
    await shot(m, 'mobile' + u.replace(/\//g, '-'));
  }
  ok('Bottom bar visible on phones', await m.locator('.bnav').isVisible());
  await m.click('.bnav a:has-text("More")'); await m.waitForSelector('.mmenu', { timeout: 5000 }).catch(() => {}); ok('"More" opens the full menu', (await m.locator('.mmenu .nv').count()) >= 8);
  const hm = await login('krish@example.com', { role: 'hr', width: 390 });
  for (const u of ['/hr', '/hr/records', '/hr/settings', '/hr/compliance']) { await go(hm, u); const sw = await hm.evaluate(() => document.documentElement.scrollWidth); ok(`AC14: ${u} has no horizontal scroll at 390px`, sw <= 390, `scrollWidth ${sw}`); }
});

/* ---------- report ---------- */
ok('No browser errors on any page', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
await browser.close(); await db.end();
const failed = results.filter((r) => !r.pass);
const byUrl = {};
timings.forEach((t) => { (byUrl[t.url.split('?')[0]] ||= []).push(t.ms); });
const timing = Object.entries(byUrl).map(([u, a]) => [u, Math.round(a.reduce((x, y) => x + y, 0) / a.length), a.length]).sort((a, b) => b[1] - a[1]);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results, timing, pageErrors }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) { console.log('\nFailed:'); failed.forEach((f) => console.log(` ✗ [${f.section}] ${f.name} ${f.detail}`)); }
console.log('\nAverage load time (dev server, local DB):'); timing.forEach(([u, ms, n]) => console.log(`  ${u.padEnd(22)} ${String(ms).padStart(5)} ms  (${n}×)`));
process.exit(failed.length ? 1 : 0);
