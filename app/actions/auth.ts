'use server';
import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { createSession, destroySession, getMe } from '@/lib/auth';
import { hashPassword, verifyPassword, totpOk } from '@/lib/crypto';
import { fmtNo, shortName } from '@/lib/names';
import { audit } from '@/lib/data';

type R = { error?: string; ok?: string };

const norm = (s: unknown) => String(s ?? '').trim();
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
/** AUTH-4: @zetheta.com and Gmail may self-register; anyone else must be on the roster. */
const allowedDomain = (e: string) => /@(zetheta\.com|gmail\.com|googlemail\.com)$/i.test(e);
const bootstrapHr = (e: string) =>
  (process.env.HR_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(e.toLowerCase());

const byEmail = async (email: string) =>
  (await db.select().from(t.people).where(sql`lower(${t.people.email}) = ${email.toLowerCase()}`).limit(1))[0];

/** Tiny brake on password guessing: 1 s per failed attempt. */
const slow = () => new Promise((r) => setTimeout(r, 1000));

async function finish(p: typeof t.people.$inferSelect, role: 'employee' | 'hr'): Promise<never> {
  if (role === 'hr') {
    await createSession(p.id, 'hr', false);
    redirect('/signin/verify');
  }
  await createSession(p.id, 'employee', true);
  await db.update(t.people).set({ lastSignIn: new Date() }).where(eq(t.people.id, p.id));
  redirect(p.status === 'pending' ? '/pending' : '/home');
}

export async function signIn(_: R | undefined, fd: FormData): Promise<R> {
  const role = fd.get('role') === 'hr' ? 'hr' : 'employee';
  const id = norm(fd.get('email')).toLowerCase();
  const pw = String(fd.get('password') ?? '');
  const code = /^zet[-\s]?(\d{1,4})$/i.exec(id);
  if (!code && !emailOk(id)) return { error: 'Enter your email ID or employee code (e.g. ZET-012).' };
  if (!pw) return { error: 'Enter your password.' };
  const p = code
    ? (await db.select().from(t.people).where(eq(t.people.empNo, fmtNo(+code[1]))).limit(1))[0]
    : await byEmail(id);
  if (!p || !p.passwordHash) {
    await slow();
    return { error: p ? 'You haven’t set a password yet. Choose “First time here?” below.' : `No account with this ${code ? 'employee code' : 'email'}. First time here? Choose “First time here?” below.` };
  }
  if (!(await verifyPassword(pw, p.passwordHash))) { await slow(); return { error: 'Wrong sign-in details or password.' }; }
  if (p.status === 'left') return { error: 'This account is closed. Ask HR if that’s a mistake.' };
  if (role === 'hr' && !p.isHr) return { error: 'This account doesn’t have HR access. Sign in as Employee.' };
  return finish(p, role);
}

export async function register(_: R | undefined, fd: FormData): Promise<R> {
  const role = fd.get('role') === 'hr' ? 'hr' : 'employee';
  const email = norm(fd.get('email')).toLowerCase();
  const name = norm(fd.get('name')).replace(/\s+/g, ' ');
  const code = norm(fd.get('code'));
  const pw = String(fd.get('password') ?? '');
  if (!emailOk(email)) return { error: 'Enter a valid email ID.' };
  if (pw.length < 8) return { error: 'Choose a password of at least 8 characters.' };

  let p = await byEmail(email);
  if (p?.passwordHash) return { error: 'This email already has an account. Sign in instead.' };

  // A roster entry for a Gmail user may have no email yet: link by employee code + first name.
  if (!p && code) {
    const m = /(\d+)/.exec(code);
    if (m) {
      const c = (await db.select().from(t.people).where(and(eq(t.people.empNo, fmtNo(+m[1])), isNull(t.people.passwordHash))).limit(1))[0];
      if (c && (c.isHr || c.isSuperadmin)) return { error: 'HR accounts are linked by email only. Ask HR to add your email in Settings.' };
      if (c && name && shortName(c.fullName).toLowerCase() === shortName(name).toLowerCase()) p = c;
      else if (c) return { error: 'That employee code doesn’t match your name. Check both, or leave the code empty.' };
    }
  }

  // First HR sign-ups: an HR_EMAILS address links to the matching HR roster entry that has no login yet.
  if (!p && bootstrapHr(email) && name) {
    const first = shortName(name).toLowerCase();
    const cands = (await db.select().from(t.people).where(and(eq(t.people.isHr, true), isNull(t.people.passwordHash))))
      .filter((c) => shortName(c.fullName).toLowerCase() === first);
    if (cands.length === 1) p = cands[0];
  }

  const hash = await hashPassword(pw);
  const hr = bootstrapHr(email);
  if (p) {
    [p] = await db.update(t.people).set({ email, passwordHash: hash, lastSignIn: new Date(), ...(hr ? { isHr: true, status: 'active' as const } : {}) })
      .where(eq(t.people.id, p.id)).returning();
    await audit(p.id, 'account.claim', p.id, { email });
  } else {
    if (!allowedDomain(email)) return { error: 'Use your @zetheta.com or Gmail ID, or ask HR to add your email to the team list.' };
    if (name.length < 2) return { error: 'Enter your full name.' };
    const [{ n }] = (await db.execute<{ n: string }>(sql`select nextval('emp_no_seq')::text as n`)).rows;
    [p] = await db.insert(t.people).values({
      empNo: fmtNo(+n), fullName: name, email, passwordHash: hash, status: hr ? 'active' : 'pending', isHr: hr,
      metrics: [], lastSignIn: new Date(),
    }).returning();
    await audit(p.id, 'account.register', p.id, { email, pending: !hr });
  }
  if (role === 'hr' && !p.isHr) return finish(p, 'employee');
  return finish(p, role);
}

export async function verifyOtp(_: R | undefined, fd: FormData): Promise<R> {
  const me = await getMe();
  if (!me) redirect('/signin');
  const code = norm(fd.get('code'));
  const secret = me.totpOn ? me.totpSecret : me.totpSetup;
  if (!secret) return { error: 'Start again from the sign-in page.' };
  if (!totpOk(secret, code)) { await slow(); return { error: 'That code didn’t match. Check the time on your phone and try the newest code.' }; }
  if (!me.totpOn) await db.update(t.people).set({ totpSecret: secret, totpOn: true }).where(eq(t.people.id, me.id));
  await db.update(t.sessions).set({ mfaOk: true, totpSetup: null }).where(eq(t.sessions.id, me.sessionId));
  await db.update(t.people).set({ lastSignIn: new Date() }).where(eq(t.people.id, me.id));
  redirect(me.status === 'pending' ? '/pending' : '/home');
}

export async function signOut() {
  await destroySession();
  redirect('/signin');
}

export async function changePassword(_: R | undefined, fd: FormData): Promise<R> {
  const me = await getMe();
  if (!me || !me.mfaOk) redirect('/signin');
  const cur = String(fd.get('current') ?? '');
  const pw = String(fd.get('password') ?? '');
  if (!me.mustChangePassword && !(await verifyPassword(cur, me.passwordHash))) return { error: 'Your current password is wrong.' };
  if (pw.length < 8) return { error: 'Choose a password of at least 8 characters.' };
  await db.update(t.people).set({ passwordHash: await hashPassword(pw), mustChangePassword: false }).where(eq(t.people.id, me.id));
  // End every other session for this person.
  await db.delete(t.sessions).where(and(eq(t.sessions.personId, me.id), sql`${t.sessions.id} <> ${me.sessionId}`));
  if (me.mustChangePassword) redirect('/home');
  return { ok: 'Password changed.' };
}

export async function markGuideSeen() {
  const me = await getMe();
  if (me) await db.update(t.people).set({ guideSeen: true }).where(eq(t.people.id, me.id));
}
