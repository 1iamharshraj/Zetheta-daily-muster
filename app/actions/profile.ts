'use server';
import { refresh } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, t } from '@/lib/db';
import { actionUser, actionHr } from '@/lib/auth';
import { audit } from '@/lib/data';
import { ADDR_FIELDS, JOB_FIELDS, PERSONAL_KEYS, addrText, pinOk, type Personal } from '@/lib/profile';
import { parseDmy } from '@/lib/time';

type R = { ok?: string; error?: string };

/** Validate + normalise the personal form (dates arrive as dd-mm-yyyy). */
function cleanPersonal(input: Record<string, unknown>): { p?: Personal; error?: string } {
  const p: Personal = {};
  for (const k of PERSONAL_KEYS) {
    const v = input[k];
    if (k === 'presentSame') { p[k] = !!v; continue; }
    p[k] = String(v ?? '').trim().slice(0, 200);
  }
  if (p.dob) {
    const iso = parseDmy(String(p.dob));
    if (!iso) return { error: 'Date of birth: enter a real date as dd-mm-yyyy.' };
    p.dob = iso;
  }
  for (const pf of ['perm', 'present'] as const) {
    if (!p[pf + 'Country']) p[pf + 'Country'] = 'India';
    p[pf + 'Pin'] = String(p[pf + 'Pin']).replace(/\D/g, '').slice(0, 6);
  }
  if (p.presentSame) ADDR_FIELDS.forEach((f) => { p['present' + f.k] = p['perm' + f.k]; });
  for (const pf of ['perm', 'present'] as const) {
    const pin = String(p[pf + 'Pin']);
    if (pin && !pinOk(pin, String(p[pf + 'Country']))) return { error: `${pf === 'perm' ? 'Permanent' : 'Present'} address: enter a valid 6-digit PIN code.` };
  }
  for (const k of ['primaryEmail', 'secondaryEmail']) {
    if (p[k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p[k]))) return { error: `${k === 'primaryEmail' ? 'Primary' : 'Secondary'} email doesn’t look right.` };
  }
  for (const k of ['mobile', 'emPhone', 'em2Phone']) {
    if (p[k] && !/^\+?[\d\s-]{8,15}$/.test(String(p[k]))) return { error: 'Phone numbers should be 10 digits (with an optional +91).' };
  }
  p.permAddr = addrText(p, 'perm');
  p.presentAddr = addrText(p, 'present');
  return { p };
}

function cleanName(n: unknown) {
  return String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function upsertHr(personId: number, patch: { personal?: Personal; job?: Record<string, string> }) {
  await db.insert(t.hrRecords).values({ personId, personal: patch.personal || {}, job: patch.job || {} })
    .onConflictDoUpdate({ target: t.hrRecords.personId, set: { ...patch, updatedAt: new Date() } });
}

export async function saveProfile(fullName: string, personal: Record<string, unknown>): Promise<R> {
  const me = await actionUser();
  const name = cleanName(fullName);
  if (name.length < 2) return { error: 'Enter your full name.' };
  const c = cleanPersonal(personal);
  if (c.error) return { error: c.error };
  await db.update(t.people).set({ fullName: name }).where(eq(t.people.id, me.id));
  await upsertHr(me.id, { personal: c.p });
  refresh();
  return { ok: 'Profile saved.' };
}

const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
export async function setPhoto(dataUrl: string | null, personId?: number): Promise<R> {
  const me = personId ? await actionHr() : await actionUser();
  const id = personId || me.id;
  if (dataUrl && (!PHOTO_RE.test(dataUrl) || dataUrl.length > 90000)) return { error: 'Couldn’t read that image. Try a JPG or PNG.' };
  await db.update(t.people).set({ photo: dataUrl }).where(eq(t.people.id, id));
  if (personId) await audit(me.id, 'person.photo', id, { removed: !dataUrl });
  refresh();
  return { ok: dataUrl ? 'Photo updated.' : 'Photo removed.' };
}

/** REC-2: HR edits employment + personal details. */
export async function saveRecord(personId: number, fullName: string, personal: Record<string, unknown>, job: Record<string, unknown>): Promise<R> {
  const me = await actionHr();
  const name = cleanName(fullName);
  if (name.length < 2) return { error: 'Enter the full name.' };
  const c = cleanPersonal(personal);
  if (c.error) return { error: c.error };
  const j: Record<string, string> = {};
  for (const f of JOB_FIELDS) {
    let v = String(job[f.k] ?? '').trim().slice(0, 200);
    if (f.type === 'date' && v) {
      const iso = parseDmy(v);
      if (!iso) return { error: `${f.l}: enter a real date as dd-mm-yyyy.` };
      v = iso;
    }
    if (f.type === 'number' && v && !(+v >= 0)) return { error: `${f.l} must be a number.` };
    j[f.k] = v;
  }
  const prev = (await db.select().from(t.hrRecords).where(eq(t.hrRecords.personId, personId)).limit(1))[0];
  await db.update(t.people).set({ fullName: name }).where(eq(t.people.id, personId));
  await upsertHr(personId, { personal: c.p, job: j });
  await audit(me.id, 'record.save', personId, { jobBefore: prev?.job || null, jobAfter: j });
  refresh();
  return { ok: 'Record saved.' };
}
