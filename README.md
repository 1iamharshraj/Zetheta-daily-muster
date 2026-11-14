# Zetheta Daily Muster v2

Attendance, daily work tracking and HR records for the Zetheta team. This is the standalone v2 of the claude.ai pilot,
built from `PRD.md` and the v1 source in `Zetheta_Daily_Muster.zip` (extracted to `reference/`, which is git-ignored).

**Stack:** Next.js 16 (App Router, server actions) · Neon Postgres via Drizzle ORM · deployed on Vercel.

## Run it locally

```bash
npm install
docker run -d --name muster-pg -e POSTGRES_PASSWORD=muster -e POSTGRES_DB=muster -p 54329:5432 postgres:17-alpine
cp .env.example .env    # set DATABASE_URL=postgres://postgres:muster@localhost:54329/muster
npm run db:migrate
npm run db:seed         # demo copy of the roster; every password is muster-dev-1, logins are <first name>@example.com
npm run dev
npm test                # rules engine and acceptance-criteria unit tests
```

The seeded HR account still has to set up an authenticator app at its first HR sign-in (scan the QR code).

## Deploy (Vercel + Neon)

1. Create a Neon project. Copy the **pooled** connection string.
2. Run the migrations against it once from your machine: `DATABASE_URL=<neon url> npm run db:migrate`.
   Don't run `db:seed` in production.
3. Import the repo into Vercel and set the environment variables from `.env.example`:
   - `DATABASE_URL`: the Neon pooled URL.
   - `HR_EMAILS`: the founder's and HR's emails. These accounts become HR the moment they create a password.
     This is how the first HR account gets in; after that, HR can grant HR access from Settings.
   - `CRON_SECRET`: a long random string.
   - `APP_URL`: the `*.vercel.app` URL, used in reminder emails.
   - Email reminders: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Any SMTP server works,
     for example a Google Workspace app password.
   - Browser push: run `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
     and `VAPID_SUBJECT`.
4. Reminders: `vercel.json` calls `/api/cron/reminders` every 15 minutes, 08:30–21:00 IST, Monday–Saturday.
   **This needs the Vercel Pro plan.** Hobby allows only one cron run a day. On Hobby, use a free external pinger
   such as cron-job.org to call `https://<app>/api/cron/reminders?key=<CRON_SECRET>` every 15 minutes.
   The endpoint is idempotent: each reminder goes to each person at most once a day.
5. Load the team: `DATABASE_URL=<neon url> npm run roster -- --email Suketu=<email> --email Harsh=<email>`.
   The list lives in `scripts/roster-data.ts`. The script only inserts people who aren't there yet, and prints each person's employee code.
6. First run: a superadmin signs in (choose **HR**), opens **Settings**, checks the rules and go-live date, and adds emails.
   Each person then chooses **First time here? → Create your password**. They're linked automatically by email,
   or, for employees only, by employee code + first name.

## Roles

| Role | Who | Can |
|---|---|---|
| Employee | everyone | Own clock-in, tasks, leave, goals, profile. View the Team pages. |
| HR | Sagar, Krish, Shama (+ superadmins) | Everything above, plus the HR desk, records, compliance, settings, approvals and registers. |
| Superadmin | Suketu, Harsh | Everything HR can do, plus give or remove HR/superadmin access and reset HR accounts' passwords, 2-step verification and logins. |

Everyone clocks in, HR and superadmins included. HR and superadmins choose **HR** at sign-in (with an authenticator code) to get
their extra pages, or **Employee** to use the app like anyone else. HR and superadmin roster entries can only be claimed by email
(set in Settings, passed to `npm run roster`, or listed in `HR_EMAILS`), never by employee code. There must always be at least
one superadmin, and nobody can remove their own access.

## How it's put together

| Path | What |
|---|---|
| `lib/rules.ts` | The rules engine (PRD §7), ported from v1. Pure functions shared by every screen and every CSV register. |
| `lib/db/schema.ts` | Tables: people (roster and login in one row), sessions, day_logs, leaves, weeks, hr_records, app_config, audit_log, push_subs, reminder_log. |
| `lib/auth.ts`, `app/actions/auth.ts` | Email + password (scrypt), 12-hour database sessions in an httpOnly cookie, TOTP for HR. |
| `app/actions/*` | Every write. Each checks the session and role on the server. Employees can only write their own data; HR-only actions call `actionHr()`. |
| `app/(app)/*` | Pages. Server components load data; client components handle interaction. |
| `app/api/registers/[kind]` | CSV registers (employees, muster, attendance, leave, overtime, payroll). HR only. |
| `app/api/cron/reminders` | Email and push reminders. |
| `app/v1.css` | v1's stylesheet, reused as-is so v2 looks like the pilot. `app/extra.css` holds the v2 additions. |

## Decisions that differ from the PRD or v1

- **No Supabase or RLS.** The database is reached only from server code, and every action checks the session and role.
  This gives the same guarantee for AC7: an employee can't read another person's HR record through the API.
- **Sign-in is email + password** (no Google sign-in). Self-registration is open to `@zetheta.com` and Gmail addresses
  and to any email HR has put on the roster. Unknown people land in **pending** until HR adds or links them.
- **Test mode (AUTH-11) is dropped.** It was a v1 convenience and would be a hole in a real portal.
- **Leave needs HR approval** (PRD open question 1). A request is *pending* until HR approves or rejects it, with an optional
  comment, and the employee is notified. Pending leave already counts against the balance and covers the day, so nobody
  shows as absent while waiting. Rejected leave stops covering the day.
- **Past-day edits apply immediately but are flagged.** HR can accept or reject an edit; rejecting restores exactly what
  was there before (a snapshot is kept on the day). Every HR decision goes into `audit_log`.
- **Late status is frozen at check-in.** Changing the grace period later doesn't rewrite last month's late marks or registers.
  An HR correction recalculates it from the corrected time.
- **Clock times come from the database clock** (`now()`), never from the device.
- **Spot checks** (from v1, missing from the PRD): HR marks an office check-in as Seen or Not in. Not in counts as an absence.

## Not done yet

- Importing v1 data. This needs a JSON export of the v1 artifact's store first; employee codes must be kept.
  Set `emp_no_seq` past the highest imported code.
- Document uploads (P2) and integrations (P3).
- Nightly backups. Neon's point-in-time restore covers this; also check that the plan's retention window meets the 5-year requirement.
