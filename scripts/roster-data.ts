import type { WorkType } from '../lib/db/schema';

export type RosterEntry = { name: string; role: string; type: WorkType; hr?: boolean; superadmin?: boolean; metrics?: string[] };

const SALES = ['calls', 'followups', 'demosBooked', 'demosDone', 'mous'];

/**
 * The Zetheta team (November 2026). Employee codes are issued in this order (ZET-001 = Suketu).
 * Roles and work patterns not known yet are left blank / hybrid; HR fills them in Settings.
 * Full names are completed by each person on My profile.
 * Everyone clocks in, HR and superadmins included. Superadmin = HR + manages who has HR access.
 */
export const ROSTER: RosterEntry[] = [
  // Superadmins (also HR)
  { name: 'Suketu', role: 'Founder & MD', type: 'hybrid', hr: true, superadmin: true },
  { name: 'Harsh', role: '', type: 'hybrid', hr: true, superadmin: true },
  // HR
  { name: 'Sagar', role: 'Employer Marketing', type: 'part', hr: true, metrics: ['calls', 'followups', 'demosBooked'] },
  { name: 'Krish', role: 'Employer Marketing', type: 'hybrid', hr: true, metrics: SALES },
  { name: 'Shama', role: 'Creative Marketing (UX/UI)', type: 'hybrid', hr: true, metrics: ['designs'] },
  // Employees
  { name: 'Aditya', role: 'AI Engineer', type: 'remote' },
  { name: 'Chitra', role: 'AI Engineer', type: 'remote' },
  { name: 'Kavi', role: '', type: 'hybrid' },
  { name: 'Khushi', role: '', type: 'hybrid' },
  { name: 'Namya', role: '', type: 'hybrid' },
  { name: 'Pranav', role: '', type: 'hybrid' },
  { name: 'Puneet', role: 'Student Marketing · LinkedIn', type: 'hybrid', metrics: ['messages', 'signups'] },
  { name: 'Radhika', role: '', type: 'hybrid' },
  { name: 'Shashank', role: '', type: 'hybrid' },
  { name: 'Vritee', role: '', type: 'hybrid' },
];
