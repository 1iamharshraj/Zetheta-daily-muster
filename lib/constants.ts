import type { Mode, TaskStatus, LeaveKind, SeniorStatus } from './db/schema';

export const METRICS: Record<string, string> = {
  calls: 'Calls made', followups: 'Follow-ups', demosBooked: 'Demos booked', demosDone: 'Demos done',
  mous: 'MoUs signed', messages: 'LinkedIn connects / DMs', emails: 'Emails sent', signups: 'Student sign-ups',
  posts: 'Posts published', designs: 'Designs delivered',
};
export const MSHORT: Record<string, string> = {
  calls: 'Calls', followups: 'F/ups', demosBooked: 'Demos bkd', demosDone: 'Demos done', mous: 'MoUs',
  messages: 'LI msgs', emails: 'Emails', signups: 'Sign-ups', posts: 'Posts', designs: 'Designs',
};
export const TSTAT: Record<TaskStatus, { l: string; c: string }> = {
  todo: { l: 'Not started', c: 'mute' }, doing: { l: 'In progress', c: 'info' }, hold: { l: 'On hold', c: 'warn' },
  blocked: { l: 'Blocked – needs help', c: 'bad' }, done: { l: 'Completed', c: 'ok' },
};
export const MODES: Record<Mode, { label: string; cls: string }> = {
  office: { label: 'Office', cls: 'ok' }, wfh: { label: 'WFH', cls: 'info' },
  remote: { label: 'Remote', cls: 'remote' }, meeting: { label: 'Meeting / Event', cls: 'event' },
};
export const modeLabel = (m: Mode | null | undefined) => (m === 'wfh' ? 'Work from home' : MODES[m || 'office']?.label || 'Office');
export const LKIND: Record<LeaveKind, string> = { casual: 'Casual leave', earned: 'Earned leave', lwp: 'Leave without pay' };
export const SENIOR: Record<SeniorStatus, { l: string; c: string }> = {
  track: { l: 'On track', c: 'ok' }, push: { l: 'Needs a push', c: 'warn' }, off: { l: 'Off track', c: 'bad' },
};
export const WORKTYPE = { hybrid: 'Hybrid', remote: 'Remote', part: 'Part-time' } as const;
export const EMP_TYPES = ['Permanent', 'Probation', 'Fixed-term', 'Intern', 'Consultant'];
export const PAY_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash'];
export const RELATIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'];
export const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Outside India',
];

export function defaultMetrics(role: string): string[] {
  const r = String(role || '').toLowerCase();
  if (/design|creative|ux|ui/.test(r)) return ['designs'];
  if (/hr|email/.test(r)) return ['emails', 'signups'];
  if (/social|instagram/.test(r)) return ['posts', 'calls', 'followups', 'demosBooked', 'demosDone', 'mous'];
  if (/linkedin|student/.test(r)) return ['messages', 'signups'];
  if (/employer|college|market|sales/.test(r)) return ['calls', 'followups', 'demosBooked', 'demosDone', 'mous'];
  return [];
}
