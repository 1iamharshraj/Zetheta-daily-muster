/** Profile fields, completion and register formatting (PRD §6.6). Shared by client and server. */

export const ADDR_FIELDS: { k: string; l: string; type: 'text' | 'select' | 'pin'; req?: boolean; hint?: string }[] = [
  { k: 'Flat', l: 'Flat / House no.', type: 'text', req: true },
  { k: 'Bldg', l: 'Building / Premises name', type: 'text', hint: '(if any)' },
  { k: 'Street', l: 'Street / Road', type: 'text', hint: '(if any)' },
  { k: 'Area', l: 'Area / Locality', type: 'text', req: true },
  { k: 'Landmark', l: 'Landmark', type: 'text', hint: '(optional)' },
  { k: 'City', l: 'City / Town / Village', type: 'text', req: true },
  { k: 'District', l: 'District', type: 'text', req: true },
  { k: 'State', l: 'State / UT', type: 'select', req: true },
  { k: 'Pin', l: 'PIN code', type: 'pin', req: true },
  { k: 'Country', l: 'Country', type: 'text', req: true },
];

export type Personal = Record<string, string | boolean>;

const g = (p: Personal, k: string) => String(p[k] ?? '').trim();

export const addrComplete = (p: Personal, pf: 'perm' | 'present') =>
  ADDR_FIELDS.filter((f) => f.req).every((f) => g(p, pf + f.k)) && pinOk(g(p, pf + 'Pin'), g(p, pf + 'Country'));

export const pinOk = (pin: string, country: string) =>
  !/^india$/i.test(country || 'India') ? true : /^[1-9]\d{5}$/.test(pin);

/** PRF-6: one-line address for registers. */
export function addrText(p: Personal, pf: 'perm' | 'present') {
  const x = (k: string) => g(p, pf + k);
  const parts = [x('Flat'), x('Bldg'), x('Street'), x('Area'), x('Landmark'), x('City'),
    x('District') && x('District') !== x('City') ? x('District') + ' district' : '',
    x('State') && x('State') !== 'Outside India' ? x('State') : '', x('Country')].filter(Boolean);
  return parts.join(', ') + (x('Pin') ? ' - ' + x('Pin') : '');
}

export const PROFILE_ITEMS: { k: string; l: string; ok: (p: Personal, extra: { photo: boolean; fullName: string }) => boolean }[] = [
  { k: 'photo', l: 'Profile photo', ok: (_, e) => e.photo },
  { k: 'fullName', l: 'Full name', ok: (_, e) => e.fullName.trim().split(/\s+/).length >= 1 && !!e.fullName.trim() },
  { k: 'gender', l: 'Gender', ok: (p) => !!g(p, 'gender') },
  { k: 'dob', l: 'Date of birth', ok: (p) => !!g(p, 'dob') },
  { k: 'qualification', l: 'Highest qualification', ok: (p) => !!g(p, 'qualification') },
  { k: 'mobile', l: 'Mobile number', ok: (p) => !!g(p, 'mobile') },
  { k: 'primaryEmail', l: 'Primary email', ok: (p) => !!g(p, 'primaryEmail') },
  { k: 'perm', l: 'Permanent address', ok: (p) => addrComplete(p, 'perm') },
  { k: 'present', l: 'Present address', ok: (p) => addrComplete(p, 'present') },
  { k: 'em', l: 'Emergency contact', ok: (p) => !!(g(p, 'emName') && g(p, 'emRel') && g(p, 'emPhone')) },
];

export function profilePct(personal: Personal | null | undefined, photo: boolean, fullName: string) {
  const p = personal || {};
  const missing = PROFILE_ITEMS.filter((i) => !i.ok(p, { photo, fullName })).map((i) => i.l);
  const done = PROFILE_ITEMS.length - missing.length;
  return { done, total: PROFILE_ITEMS.length, pct: Math.round((100 * done) / PROFILE_ITEMS.length), missing };
}

export const JOB_FIELDS: { k: string; l: string; type: 'text' | 'date' | 'select' | 'number'; opts?: string[] }[] = [
  { k: 'designation', l: 'Designation', type: 'text' },
  { k: 'department', l: 'Department', type: 'text' },
  { k: 'category', l: 'Employment type', type: 'select', opts: ['Permanent', 'Probation', 'Fixed-term', 'Intern', 'Consultant'] },
  { k: 'doj', l: 'Date of joining', type: 'date' },
  { k: 'probationEnd', l: 'Probation ends', type: 'date' },
  { k: 'fixedTermEnd', l: 'Fixed-term ends', type: 'date' },
  { k: 'wageMonthly', l: 'Monthly wages (₹)', type: 'number' },
  { k: 'payMode', l: 'Mode of payment', type: 'select', opts: ['Bank transfer', 'UPI', 'Cheque', 'Cash'] },
  { k: 'uan', l: 'UAN', type: 'text' },
  { k: 'esicIp', l: 'ESIC IP no.', type: 'text' },
  { k: 'apptLetterDate', l: 'Appointment letter date', type: 'date' },
  { k: 'openingEL', l: 'Earned leave brought forward', type: 'number' },
  { k: 'exitDate', l: 'Date of leaving', type: 'date' },
  { k: 'exitReason', l: 'Reason for leaving', type: 'text' },
];

/** Keys an employee may write in their own personal record. */
export const PERSONAL_KEYS = [
  'gender', 'dob', 'qualification', 'mobile', 'primaryEmail', 'secondaryEmail',
  ...ADDR_FIELDS.map((f) => 'perm' + f.k), ...ADDR_FIELDS.map((f) => 'present' + f.k), 'presentSame',
  'emName', 'emRel', 'emPhone', 'em2Name', 'em2Rel', 'em2Phone',
];
