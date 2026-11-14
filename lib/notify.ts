import 'server-only';
import { after } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { db, t } from './db';

const appUrl = () => (process.env.APP_URL || '').replace(/\/$/, '');

export const emailEnabled = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER);
export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;
function getMailer() {
  if (!emailEnabled()) return null;
  if (!mailer) {
    const port = +(process.env.SMTP_PORT || 465);
    mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  return mailer;
}

let vapidSet = false;
function setupPush() {
  if (!pushEnabled()) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hr@zetheta.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
  return true;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function sendEmail(to: string, subject: string, body: string, url?: string) {
  const m = getMailer();
  if (!m || !to) return false;
  const link = url ? appUrl() + url : appUrl();
  await m.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject,
    text: `${body}\n\n${link}`,
    html: `<div style="font-family:Jost,Arial,sans-serif;font-size:15px;color:#14222D"><p>${esc(body)}</p><p><a href="${esc(link)}" style="display:inline-block;background:#175F7F;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">Open the muster</a></p><p style="color:#5C6B77;font-size:12px">Zetheta Daily Muster</p></div>`,
  });
  return true;
}

export async function sendPush(personIds: number[], title: string, body: string, url = '/home') {
  if (!setupPush() || !personIds.length) return 0;
  const subs = await db.select().from(t.pushSubs).where(inArray(t.pushSubs.personId, personIds));
  let n = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url }), { TTL: 3600 });
      n++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(t.pushSubs).where(eq(t.pushSubs.endpoint, s.endpoint));
    }
  }));
  return n;
}

/** Push + email to one person. Never throws. */
export async function deliver(p: { id: number; email: string | null }, title: string, body: string, url: string, channels = { email: true, push: true }) {
  const res = { push: 0, email: false };
  try { if (channels.push) res.push = await sendPush([p.id], title, body, url); } catch { /* ignore */ }
  try { if (channels.email && p.email) res.email = await sendEmail(p.email, title, body, url); } catch { /* ignore */ }
  return res;
}

/** Tell HR about something that needs a decision. Runs after the response is sent. */
export async function notifyHr(_kind: string, title: string, body: string, url: string) {
  after(async () => {
    const hr = await db.select({ id: t.people.id, email: t.people.email }).from(t.people).where(and(eq(t.people.isHr, true), eq(t.people.status, 'active')));
    for (const p of hr) await deliver(p, title, body, url, { email: false, push: true });
  });
}

/** Tell an employee about a decision on their request. */
export async function notifyPerson(personId: number, title: string, body: string, url: string) {
  after(async () => {
    const p = (await db.select({ id: t.people.id, email: t.people.email }).from(t.people).where(eq(t.people.id, personId)).limit(1))[0];
    if (p) await deliver(p, title, body, url);
  });
}
