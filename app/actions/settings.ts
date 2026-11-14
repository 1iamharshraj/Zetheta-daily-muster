'use server';
import { refresh } from 'next/cache';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionHr } from '@/lib/auth';
import type { Me } from '@/lib/auth';
import { audit, getConfig, getSettings, setConfig } from '@/lib/data';
import { DEFAULTS, type Settings } from '@/lib/settings';
import { parseDmy } from '@/lib/time';
import { fmtNo, renameFirst, shortName } from '@/lib/names';
import { METRICS, defaultMetrics } from '@/lib/constants';
import { hashPassword, tempPassword } from '@/lib/crypto';
import type { WorkType } from '@/lib/db/schema';

type R = { ok?: string; error?: string };
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lines like 'dd-mm-yyyy Name' (or yyyy-mm-dd) -> 'yyyy-mm-dd Name'. Returns the bad line on error. */
function parseDateLines(txt: string, withName: boolean): { out?: string[]; bad?: string } {
  const out: string[] = [];
  for (const raw of String(txt || '').split('\n')) {
    const x = raw.trim();
    if (!x) continue;
    const m = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(x);
    if (!m) return { bad: x };
    let iso: string | null = m[1];
    if (!/^\d{4}-/.test(iso)) { const [d, mo, y] = iso.split(/[-/.]/); iso = parseDmy(`${d.padStart(2, '0')}-${mo.padStart(2, '0')}-${y}`); }
    else if (!parseDmy(`${iso.slice(8)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`)) iso = null;
    if (!iso) return { bad: x };
    out.push(withName ? `${iso} ${m[2].trim() || 'Holiday'}` : iso);
  }
  return { out: [...new Set(out)].sort() };
}

export async function saveSettings(v: Record<string, unknown>): Promise<R> {
  const me = await actionHr();
  const n = (k: string, min: number, max: number) => { const x = Number(v[k]); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : (DEFAULTS as unknown as Record<string, number>)[k]; };
  for (const k of ['officeStart', 'planBy', 'eodBy']) if (!HM.test(String(v[k]))) return { error: 'Times must be like 10:00.' };
  const goLive = parseDmy(String(v.goLive || ''));
  if (!goLive) return { error: 'Rules count from: enter a date as dd-mm-yyyy.' };
  const hol = parseDateLines(String(v.holidays || ''), true);
  if (hol.bad) return { error: `Holiday line not understood: “${hol.bad}”. Use dd-mm-yyyy Name.` };
  const gms = parseDateLines(String(v.gamesdays || ''), false);
  if (gms.bad) return { error: `Gamesday line not understood: “${gms.bad}”. Use dd-mm-yyyy.` };
  const workdays = (Array.isArray(v.workdays) ? v.workdays : []).map(Number).filter((x) => x >= 0 && x <= 6);
  if (!workdays.length) return { error: 'Pick at least one working day.' };
  const prev = await getSettings();
  const s: Settings = {
    ...prev,
    officeStart: String(v.officeStart), planBy: String(v.planBy), eodBy: String(v.eodBy),
    graceMin: n('graceMin', 0, 180), latesPerHalfDay: n('latesPerHalfDay', 1, 31), severeLateMin: n('severeLateMin', 1, 600),
    officeDaysPerWeek: n('officeDaysPerWeek', 0, 7), weeklyHours: n('weeklyHours', 1, 80), casualLeave: n('casualLeave', 0, 60),
    earnedLeave: n('earnedLeave', 0, 60), dailyMaxHours: n('dailyMaxHours', 1, 24), weeklyMaxHours: n('weeklyMaxHours', 1, 100),
    leaveYearStartMonth: n('leaveYearStartMonth', 1, 12), goLive, lateAppliesToWfh: !!v.lateAppliesToWfh,
    workdays: [...new Set(workdays)].sort(), holidays: hol.out!, gamesdays: gms.out!,
    reminders: { email: !!v.remindEmail, push: !!v.remindPush },
  };
  await setConfig('settings', s);
  await audit(me.id, 'settings.save', null, { before: prev, after: s });
  refresh();
  return { ok: 'Rules saved.' };
}

export async function saveCompliance(k: string, patch: { st?: string; date?: string; note?: string }): Promise<R> {
  const me = await actionHr();
  if (!/^[a-z]{2,12}$/.test(k)) return { error: 'Unknown item.' };
  const all = await getConfig<Record<string, Record<string, string>>>('compliance', {});
  const cur = { ...(all[k] || {}) };
  if (patch.st !== undefined) { if (!['todo', 'doing', 'done', 'na'].includes(patch.st)) return { error: 'Unknown status.' }; cur.st = patch.st; }
  if (patch.date !== undefined) {
    if (patch.date && !parseDmy(patch.date)) return { error: 'Enter the date as dd-mm-yyyy.' };
    cur.date = patch.date ? parseDmy(patch.date)! : '';
  }
  if (patch.note !== undefined) cur.note = String(patch.note).trim().slice(0, 160);
  await setConfig('compliance', { ...all, [k]: cur });
  await audit(me.id, 'compliance.save', null, { k, ...patch });
  refresh();
  return { ok: 'Saved.' };
}

/* ---------- roster ---------- */

const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
async function emailTaken(email: string, exceptId?: number) {
  if (!email) return false;
  const r = await db.select({ id: t.people.id }).from(t.people).where(sql`lower(${t.people.email}) = ${email}`).limit(1);
  return !!r[0] && r[0].id !== exceptId;
}

export async function addPerson(v: { fullName: string; role: string; email: string; type: WorkType }): Promise<R> {
  const me = await actionHr();
  const fullName = String(v.fullName || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (fullName.length < 2) return { error: 'Enter the person’s full name.' };
  const email = normEmail(v.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email doesn’t look right.' };
  if (await emailTaken(email)) return { error: 'Someone already has that email.' };
  const role = String(v.role || '').trim().slice(0, 80);
  const [{ n }] = (await db.execute<{ n: string }>(sql`select nextval('emp_no_seq')::text as n`)).rows;
  const [p] = await db.insert(t.people).values({
    empNo: fmtNo(+n), fullName, role, email: email || null, type: ['hybrid', 'remote', 'part'].includes(v.type) ? v.type : 'hybrid',
    metrics: defaultMetrics(role), status: 'active',
  }).returning();
  await audit(me.id, 'person.add', p.id, { fullName, email, role });
  refresh();
  return { ok: `${shortName(fullName)} added as ${p.empNo}. They can now create their password with ${email || 'their email'}.` };
}

/** HR and superadmin accounts can only be managed by a superadmin. */
async function guardPrivileged(me: Me, id: number): Promise<string | null> {
  const p = (await db.select().from(t.people).where(eq(t.people.id, id)).limit(1))[0];
  if (!p) return 'Person not found.';
  if ((p.isHr || p.isSuperadmin) && !me.isSuperadmin && p.id !== me.id) return 'Only a superadmin can change an HR account’s login.';
  return null;
}

export async function updatePerson(id: number, v: { name: string; role: string; email: string; type: WorkType; active: boolean; metrics: string[]; isHr: boolean; isSuperadmin?: boolean }): Promise<R> {
  const me = await actionHr();
  const p = (await db.select().from(t.people).where(eq(t.people.id, id)).limit(1))[0];
  if (!p) return { error: 'Person not found.' };
  const wantSuper = v.isSuperadmin === undefined ? p.isSuperadmin : !!v.isSuperadmin;
  const wantHr = !!v.isHr || wantSuper; // superadmin implies HR
  if ((wantHr !== p.isHr || wantSuper !== p.isSuperadmin) && !me.isSuperadmin) return { error: 'Only a superadmin can give or remove HR access.' };
  if ((p.isHr || p.isSuperadmin) && !me.isSuperadmin && id !== me.id && (normEmail(v.email) !== normEmail(p.email) || !v.active)) return { error: 'Only a superadmin can change an HR account’s email or status.' };
  if (p.isSuperadmin && (!wantSuper || !v.active)) {
    const [{ n }] = (await db.execute<{ n: string }>(sql`select count(*)::text as n from people where is_superadmin and status = 'active'`)).rows;
    if (+n <= 1) return { error: 'There must always be at least one superadmin.' };
    if (id === me.id) return { error: 'You can’t remove your own superadmin access. Ask the other superadmin.' };
  }
  const email = normEmail(v.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email doesn’t look right.' };
  if (await emailTaken(email, id)) return { error: 'Someone else already has that email.' };
  if (p.passwordHash && !email) return { error: 'This person signs in with their email, so it can’t be blank.' };
  if (id === me.id && (!wantHr || !v.active)) return { error: 'You can’t remove your own HR access or deactivate yourself.' };
  const disp = String(v.name || '').replace(/\s+/g, ' ').trim();
  if (!disp) return { error: 'Name can’t be empty.' };
  const fullName = disp === shortName(p.fullName) ? p.fullName : renameFirst(p.fullName, disp); // NAME-4
  const status = v.active ? (p.status === 'pending' ? 'pending' : 'active') : 'left';
  const metrics = (v.metrics || []).filter((m) => METRICS[m]);
  await db.update(t.people).set({
    fullName, role: String(v.role || '').trim().slice(0, 80), email: email || null,
    type: ['hybrid', 'remote', 'part'].includes(v.type) ? v.type : 'hybrid', status, metrics, isHr: wantHr, isSuperadmin: wantSuper,
  }).where(eq(t.people.id, id));
  if (status === 'left' || (!wantHr && p.isHr)) await db.delete(t.sessions).where(eq(t.sessions.personId, id));
  await audit(me.id, 'person.update', id, { before: { fullName: p.fullName, role: p.role, email: p.email, type: p.type, status: p.status, isHr: p.isHr }, after: { fullName, email, status, isHr: wantHr, isSuperadmin: wantSuper } });
  refresh();
  return { ok: 'Saved.' };
}

/** SET-6: confirm a self-registration. */
export async function approvePending(id: number, role: string, type: WorkType): Promise<R> {
  const me = await actionHr();
  const p = (await db.select().from(t.people).where(and(eq(t.people.id, id), eq(t.people.status, 'pending'))).limit(1))[0];
  if (!p) return { error: 'Already handled.' };
  role = String(role || '').trim().slice(0, 80);
  await db.update(t.people).set({ status: 'active', role, type: ['hybrid', 'remote', 'part'].includes(type) ? type : 'hybrid', metrics: defaultMetrics(role) }).where(eq(t.people.id, id));
  await audit(me.id, 'person.approve', id, { role, type });
  refresh();
  return { ok: `${shortName(p.fullName)} added to the team.` };
}

/** SET-6: the registration is really an existing roster entry (e.g. a Gmail user). Move the login onto it. */
export async function linkPending(pendingId: number, targetId: number): Promise<R> {
  const me = await actionHr();
  const [pend] = await db.select().from(t.people).where(and(eq(t.people.id, pendingId), eq(t.people.status, 'pending'))).limit(1);
  const [tgt] = await db.select().from(t.people).where(and(eq(t.people.id, targetId), isNull(t.people.passwordHash))).limit(1);
  if (!pend || !tgt) return { error: 'Pick a team member who hasn’t signed in yet.' };
  await db.transaction(async (tx) => {
    await tx.delete(t.people).where(eq(t.people.id, pend.id));
    await tx.update(t.people).set({ email: pend.email, passwordHash: pend.passwordHash, photo: tgt.photo || pend.photo, lastSignIn: pend.lastSignIn }).where(eq(t.people.id, tgt.id));
  });
  await audit(me.id, 'person.link', tgt.id, { pendingEmpNo: pend.empNo, email: pend.email });
  refresh();
  return { ok: `Linked. ${shortName(tgt.fullName)} signs in with ${pend.email}. (${pend.empNo} is retired, never reused.)` };
}

export async function removePending(id: number): Promise<R> {
  const me = await actionHr();
  const r = await db.delete(t.people).where(and(eq(t.people.id, id), eq(t.people.status, 'pending'))).returning();
  if (!r.length) return { error: 'Already handled.' };
  await audit(me.id, 'person.reject', id, { email: r[0].email, empNo: r[0].empNo });
  refresh();
  return { ok: 'Registration removed.' };
}

/** AUTH-10: HR resets a password. Returns a one-time temporary password to pass on. */
export async function resetPassword(id: number): Promise<R & { temp?: string }> {
  const me = await actionHr();
  const g = await guardPrivileged(me, id);
  if (g) return { error: g };
  const temp = tempPassword();
  const r = await db.update(t.people).set({ passwordHash: await hashPassword(temp), mustChangePassword: true }).where(eq(t.people.id, id)).returning();
  if (!r.length) return { error: 'Person not found.' };
  await db.delete(t.sessions).where(eq(t.sessions.personId, id));
  await audit(me.id, 'account.resetPassword', id);
  return { ok: 'Password reset.', temp };
}

export async function resetTotp(id: number): Promise<R> {
  const me = await actionHr();
  if (!me.isSuperadmin) return { error: 'Only a superadmin can reset 2-step verification.' };
  await db.update(t.people).set({ totpSecret: null, totpOn: false }).where(eq(t.people.id, id));
  await db.delete(t.sessions).where(and(eq(t.sessions.personId, id), eq(t.sessions.role, 'hr')));
  await audit(me.id, 'account.resetTotp', id);
  refresh();
  return { ok: '2-step verification reset. They’ll scan a new QR code at their next HR sign-in.' };
}

/** AUTH-10: detach the login so the person can register again (history stays). */
export async function unlinkAccount(id: number): Promise<R> {
  const me = await actionHr();
  if (id === me.id) return { error: 'You can’t unlink your own account.' };
  const g = await guardPrivileged(me, id);
  if (g) return { error: g };
  await db.update(t.people).set({ passwordHash: null, totpSecret: null, totpOn: false, mustChangePassword: false }).where(eq(t.people.id, id));
  await db.delete(t.sessions).where(eq(t.sessions.personId, id));
  await db.delete(t.pushSubs).where(eq(t.pushSubs.personId, id));
  await audit(me.id, 'account.unlink', id);
  refresh();
  return { ok: 'Unlinked. They can create a new password with “First time here?”.' };
}
