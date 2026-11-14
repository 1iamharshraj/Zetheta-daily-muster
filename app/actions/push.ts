'use server';
import { eq } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { sendPush } from '@/lib/notify';

type R = { ok?: string; error?: string };

export async function subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<R> {
  const me = await actionUser();
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: 'Your browser didn’t give a valid subscription.' };
  await db.insert(t.pushSubs).values({ endpoint: sub.endpoint, personId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({ target: t.pushSubs.endpoint, set: { personId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  await sendPush([me.id], 'Reminders are on', 'You’ll get a nudge here if you forget to clock in, plan or write your summary.', '/home');
  return { ok: 'Reminders turned on for this device.' };
}

export async function unsubscribePush(endpoint: string): Promise<R> {
  const me = await actionUser();
  const row = (await db.select().from(t.pushSubs).where(eq(t.pushSubs.endpoint, endpoint)).limit(1))[0];
  if (row && row.personId === me.id) await db.delete(t.pushSubs).where(eq(t.pushSubs.endpoint, endpoint));
  return { ok: 'Reminders turned off for this device.' };
}
