import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, 32, PARAMS);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [alg, s, h] = stored.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = await scrypt(pw.normalize('NFKC'), Buffer.from(s, 'base64'), want.length, PARAMS);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');
export const token = (n = 32) => randomBytes(n).toString('base64url');

/** Readable temporary password for HR resets (no 0/O/1/l). */
export function tempPassword() {
  const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(12), (b) => A[b % A.length]).join('');
}

/* ---------- TOTP (RFC 6238: SHA-1, 30 s, 6 digits) ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32enc(u: Uint8Array) {
  let bits = 0, val = 0, out = '';
  for (const b of u) {
    val = ((val << 8) | b) & 0xffff; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32dec(x: string) {
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const c of x.replace(/[\s=]/g, '').toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = ((val << 5) | i) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
export const newTotpSecret = () => b32enc(randomBytes(20));
export function totpAt(secret: string, step: number) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(step / 4294967296), 0);
  buf.writeUInt32BE(step >>> 0, 4);
  const h = createHmac('sha1', b32dec(secret)).update(buf).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}
export function totpOk(secret: string, code: string, now = Date.now()) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  const st = Math.floor(now / 30000);
  return [-1, 0, 1].some((d) => totpAt(secret, st + d) === c);
}
