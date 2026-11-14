import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, lt } from 'drizzle-orm';
import { cache } from 'react';
import { db, t } from './db';
import { sha256, token, newTotpSecret } from './crypto';

const COOKIE = 'muster_sess';
const TTL_MS = 12 * 3600 * 1000; // AUTH-9

export type Me = typeof t.people.$inferSelect & { sessionRole: 'employee' | 'hr'; mfaOk: boolean; sessionId: string; totpSetup: string | null };

export async function createSession(personId: number, role: 'employee' | 'hr', mfaOk: boolean) {
  const tok = token();
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(t.sessions).values({ id: sha256(tok), personId, role, mfaOk, expiresAt });
  await db.delete(t.sessions).where(lt(t.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, tok, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const tok = jar.get(COOKIE)?.value;
  if (tok) await db.delete(t.sessions).where(eq(t.sessions.id, sha256(tok)));
  jar.delete(COOKIE);
}

/** Current signed-in person (any state), or null. Cached per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const tok = (await cookies()).get(COOKIE)?.value;
  if (!tok) return null;
  const rows = await db.select().from(t.sessions).innerJoin(t.people, eq(t.sessions.personId, t.people.id)).where(eq(t.sessions.id, sha256(tok))).limit(1);
  const r = rows[0];
  if (!r || r.sessions.expiresAt.getTime() < Date.now()) return null;
  const p = r.people;
  // HR rights can be revoked at any time; a stale HR session then behaves as employee.
  const role = r.sessions.role === 'hr' && p.isHr ? 'hr' : 'employee';
  return { ...p, sessionRole: role, mfaOk: r.sessions.mfaOk, sessionId: r.sessions.id, totpSetup: r.sessions.totpSetup };
});

/** A fully signed-in, active person. Redirects otherwise. */
export async function requireUser() {
  const me = await getMe();
  if (!me || !me.mfaOk) redirect('/signin');
  if (me.status === 'pending') redirect('/pending');
  if (me.status === 'left') redirect('/signin?left=1');
  if (me.mustChangePassword) redirect('/change-password');
  return me;
}

export async function requireHr() {
  const me = await requireUser();
  if (me.sessionRole !== 'hr') redirect('/home');
  return me;
}

/** For server actions: throw instead of redirect so the client gets a message. */
export async function actionUser() {
  const me = await getMe();
  if (!me || !me.mfaOk || me.status !== 'active' || me.mustChangePassword) throw new Error('Your session has ended. Sign in again.');
  return me;
}
export async function actionHr() {
  const me = await actionUser();
  if (me.sessionRole !== 'hr') throw new Error('Only HR can do this.');
  return me;
}
/** Managing HR/superadmin access and HR accounts' logins. Signed in as HR and flagged superadmin. */
export async function actionSuper() {
  const me = await actionHr();
  if (!me.isSuperadmin) throw new Error('Only a superadmin can do this.');
  return me;
}

/** First HR sign-in: create (once per session) the secret the QR code shows. */
export async function ensureTotpSetup(sessionId: string) {
  const s = (await db.select().from(t.sessions).where(eq(t.sessions.id, sessionId)).limit(1))[0];
  if (s?.totpSetup) return s.totpSetup;
  const secret = newTotpSecret();
  await db.update(t.sessions).set({ totpSetup: secret }).where(eq(t.sessions.id, sessionId));
  return secret;
}
