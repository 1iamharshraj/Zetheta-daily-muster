const PREFIX = /^(mr|mrs|ms|miss|mx|dr|ca|cs|cma|prof|er|adv|shri|sri|smt|kum|kumari|capt|col|lt|maj|sir|dame)\.?$/i;

/** NAME-1/2: first word of the full name, keeping any leading titles. "Dr. Krish Mehta" -> "Dr. Krish". */
export function shortName(full: string) {
  const w = String(full || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out: string[] = [];
  for (const x of w) {
    out.push(x);
    if (!PREFIX.test(x)) break;
  }
  return out.join(' ');
}

/** NAME-4: replace only the first-name part (after titles) of a full name, keeping the surname. */
export function renameFirst(full: string, newFirst: string) {
  const w = String(full || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const n = shortName(full).split(' ').filter(Boolean).length;
  const rest = w.slice(n).join(' ');
  return [newFirst.trim(), rest].filter(Boolean).join(' ');
}

export const initials = (n: string) =>
  String(n || '?').trim().split(/\s+/).filter((w) => !PREFIX.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export const hueOf = (x: string) => {
  let h = 7;
  for (const c of String(x)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export const fmtNo = (n: number) => 'ZET-' + String(n).padStart(3, '0');
export const byName = (a: { fullName: string }, b: { fullName: string }) =>
  shortName(a.fullName).localeCompare(shortName(b.fullName), 'en', { sensitivity: 'base' }) ||
  a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' });
