/** All dates are IST calendar keys 'YYYY-MM-DD'. All instants are ISO strings. */
export const TZ = 'Asia/Kolkata';

const fD = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fT = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const fHM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

export const keyOf = (d: Date | string | number) => fD.format(new Date(d));
export const todayKey = (now: Date = new Date()) => keyOf(now);
/** Minutes since IST midnight. */
export const minsOf = (d: Date | string) => {
  const [h, m] = fHM.format(new Date(d)).split(':').map(Number);
  return (h % 24) * 60 + m;
};
export const hm2m = (s: string) => {
  const [h, m] = String(s || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};
export const m2label = (m: number) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const tLabel = (iso?: string | null) => (iso ? fT.format(new Date(iso)).toUpperCase() : '—');
export const hmOf = (iso?: string | null) => (iso ? fHM.format(new Date(iso)) : '');
export const isoAt = (k: string, hm: string) => new Date(`${k}T${hm}:00+05:30`).toISOString();

export const kd = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const addD = (k: string, n: number) => {
  const t = kd(k);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const dow = (k: string) => kd(k).getUTCDay();
export const monday = (k: string) => addD(k, dow(k) === 0 ? -6 : 1 - dow(k));
export const monthOf = (k: string) => k.slice(0, 7);
export const dim = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const addMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
export const daysOfMonth = (ym: string) =>
  Array.from({ length: dim(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);

export const fmtLong = (k: string) =>
  kd(k).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' });
export const fmtShort = (k: string) =>
  kd(k).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
export const fmtMonth = (ym: string) =>
  kd(ym + '-01').toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });
/** 'YYYY-MM-DD' -> 'dd-mm-yyyy' (PRD: all dates shown as dd-mm-yyyy). */
export const dmy = (k?: string | null) => (k && /^\d{4}-\d{2}-\d{2}/.test(k) ? `${k.slice(8, 10)}-${k.slice(5, 7)}-${k.slice(0, 4)}` : '');
/** 'dd-mm-yyyy' -> 'YYYY-MM-DD', or null when impossible (e.g. 31-02-2001). */
export const parseDmy = (s: string): string | null => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  if (mo < 1 || mo > 12 || d < 1 || y < 1900 || y > 2200) return null;
  const k = `${m[3]}-${m[2]}-${m[1]}`;
  return kd(k).getUTCDate() === d && kd(k).getUTCMonth() === mo - 1 ? k : null;
};
export const hrs = (h: number) => {
  const m = Math.max(0, Math.round(h * 60));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
export const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
