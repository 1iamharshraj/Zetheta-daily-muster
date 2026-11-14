import { sql } from 'drizzle-orm';
import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, date, primaryKey, index, uniqueIndex, pgSequence,
} from 'drizzle-orm/pg-core';

/** Employee codes (ZET-NNN) come from this sequence: sequential, never reused. */
export const empNoSeq = pgSequence('emp_no_seq', { startWith: 1 });

export type WorkType = 'hybrid' | 'remote' | 'part';
export type PersonStatus = 'pending' | 'active' | 'left';

/** One row per person. A roster entry and the sign-in account are the same row. */
export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  empNo: text('emp_no').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default(''),
  type: text('type').$type<WorkType>().notNull().default('hybrid'),
  metrics: text('metrics').array().notNull().default(sql`'{}'::text[]`),
  status: text('status').$type<PersonStatus>().notNull().default('active'),
  isHr: boolean('is_hr').notNull().default(false),
  /** Superadmin: HR access plus managing who has HR/superadmin access. Still clocks in like everyone. */
  isSuperadmin: boolean('is_superadmin').notNull().default(false),
  email: text('email'),
  passwordHash: text('password_hash'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  totpSecret: text('totp_secret'),
  totpOn: boolean('totp_on').notNull().default(false),
  photo: text('photo'),
  guideSeen: boolean('guide_seen').notNull().default(false),
  lastSignIn: timestamp('last_sign_in', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('people_email_uq').on(sql`lower(${t.email})`)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  role: text('role').$type<'employee' | 'hr'>().notNull(),
  mfaOk: boolean('mfa_ok').notNull().default(true),
  totpSetup: text('totp_setup'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TaskStatus = 'todo' | 'doing' | 'hold' | 'blocked' | 'done';
export type Task = { id: string; text: string; status: TaskStatus; carried?: boolean };
export type Mode = 'office' | 'wfh' | 'remote' | 'meeting';
export type LateStatus = 'none' | 'late' | 'severe' | 'exempt';
export type DayEdit = {
  reason: string; by: number; at: string; status: 'pending' | 'approved' | 'rejected';
  prev: Record<string, unknown> | null; decidedBy?: number; decidedAt?: string;
};

export const dayLogs = pgTable('day_logs', {
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  mode: text('mode').$type<Mode>(),
  intent: text('intent').$type<Mode>(),
  checkInAt: timestamp('check_in_at', { withTimezone: true, mode: 'string' }),
  checkInSrc: text('check_in_src').$type<'server' | 'manual' | 'hr'>(),
  checkOutAt: timestamp('check_out_at', { withTimezone: true, mode: 'string' }),
  checkOutSrc: text('check_out_src').$type<'server' | 'manual' | 'hr'>(),
  /** Late status frozen when the check-in is written, so later rule changes don't rewrite history. */
  lateMins: integer('late_mins'),
  lateStatus: text('late_status').$type<LateStatus>(),
  lateExcused: boolean('late_excused').notNull().default(false),
  meetingNote: text('meeting_note'),
  plan: jsonb('plan').$type<Task[]>().notNull().default([]),
  eod: text('eod'),
  blocker: jsonb('blocker').$type<{ text: string; resolved?: boolean; at?: string } | null>(),
  metrics: jsonb('metrics').$type<Record<string, number>>().notNull().default({}),
  spot: text('spot').$type<'yes' | 'no' | null>(),
  edit: jsonb('edit').$type<DayEdit | null>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.personId, t.date] }), index('day_logs_date_idx').on(t.date)]);

export type LeaveKind = 'casual' | 'earned' | 'lwp';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  half: boolean('half').notNull().default(false),
  kind: text('kind').$type<LeaveKind>().notNull().default('casual'),
  reason: text('reason').notNull().default(''),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  status: text('status').$type<LeaveStatus>().notNull().default('pending'),
  source: text('source').$type<'employee' | 'hr'>().notNull().default('employee'),
  decidedBy: integer('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'string' }),
  hrComment: text('hr_comment'),
}, (t) => [
  uniqueIndex('leaves_live_uq').on(t.personId, t.date).where(sql`status in ('pending','approved')`),
  index('leaves_date_idx').on(t.date),
]);

export type Target = { id: string; text: string; metric: string | null; goal: number; done: number };
export type SeniorStatus = 'track' | 'push' | 'off';

export const weeks = pgTable('weeks', {
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  monday: date('monday', { mode: 'string' }).notNull(),
  targets: jsonb('targets').$type<Target[]>().notNull().default([]),
  selfReview: text('self_review').notNull().default(''),
  seniorStatus: text('senior_status').$type<SeniorStatus | null>(),
  seniorComment: text('senior_comment'),
  seniorBy: integer('senior_by'),
  seniorAt: timestamp('senior_at', { withTimezone: true, mode: 'string' }),
}, (t) => [primaryKey({ columns: [t.personId, t.monday] })]);

export const hrRecords = pgTable('hr_records', {
  personId: integer('person_id').primaryKey().references(() => people.id, { onDelete: 'cascade' }),
  personal: jsonb('personal').$type<Record<string, string | boolean>>().notNull().default({}),
  job: jsonb('job').$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Singleton documents: 'settings', 'compliance'. */
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id'),
  action: text('action').notNull(),
  targetId: integer('target_id'),
  detail: jsonb('detail'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('audit_at_idx').on(t.at)]);

export const pushSubs = pgTable('push_subs', {
  endpoint: text('endpoint').primaryKey(),
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reminderLog = pgTable('reminder_log', {
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  kind: text('kind').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.personId, t.date, t.kind] })]);
