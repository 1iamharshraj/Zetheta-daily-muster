<div align="center">

<img src="public/logo.png" alt="Zetheta" width="72" />

# Zetheta Daily Muster

**Attendance, daily work tracking and statutory HR records for the Zetheta team, in under two minutes a day.**

[![CI](https://github.com/1iamharshraj/Zetheta-daily-muster/actions/workflows/ci.yml/badge.svg)](https://github.com/1iamharshraj/Zetheta-daily-muster/actions/workflows/ci.yml)
[![Reminders](https://github.com/1iamharshraj/Zetheta-daily-muster/actions/workflows/reminders.yml/badge.svg)](https://github.com/1iamharshraj/Zetheta-daily-muster/actions/workflows/reminders.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon-Postgres%2018-00E599?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle&logoColor=black)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
<br/>
![Unit tests](https://img.shields.io/badge/unit%20tests-13%20passing-1B7346)
![E2E](https://img.shields.io/badge/end--to--end-199%2F199%20checks-1B7346)
![Mobile](https://img.shields.io/badge/mobile-390px%20ready-175F7F)
![Themes](https://img.shields.io/badge/themes-light%20%7C%20dark%20%7C%20auto-175F7F)
![Region](https://img.shields.io/badge/region-ap--southeast--1%20(Singapore)-F47625)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

[Features](#-features) ·
[Screenshots](#-screenshots) ·
[Architecture](#-architecture) ·
[Getting started](#-getting-started) ·
[Deployment](#-deployment) ·
[Rules engine](#-the-rules-engine) ·
[Security](#-security--privacy) ·
[Testing](#-testing) ·
[Roadmap](#-roadmap)

</div>

---

## Contents

- [Why this exists](#-why-this-exists)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Roles & permissions](#-roles--permissions)
- [Architecture](#-architecture)
- [Data model](#-data-model)
- [Key flows](#-key-flows)
- [The rules engine](#-the-rules-engine)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [Deployment](#-deployment)
- [Configuration](#-configuration)
- [Operations runbook](#-operations-runbook)
- [Testing](#-testing)
- [Project structure](#-project-structure)
- [Security & privacy](#-security--privacy)
- [Performance](#-performance)
- [Decisions & deviations from the PRD](#-decisions--deviations-from-the-prd)
- [Roadmap](#-roadmap)

---

## 🎯 Why this exists

Zetheta is a small, mostly hybrid team. Earlier tracking (a GitHub tracker, a WhatsApp group, an hourly Excel sheet) failed because it was tedious and easy to ignore. Two problems remained:

1. **Lateness had no consequence.** There was no reliable record of check-in times and no rule turning lateness into leave cuts.
2. **Nobody could see the team's day at a glance**: who is working, what they planned, what's done and what's blocked.

The company also has to keep **statutory registers** (employees, attendance, leave, overtime) under the labour codes in force from 21 Nov 2025 and Maharashtra law.

The Daily Muster replaces all of that: **clock in → plan tasks → update as you go → write two lines → clock out**. Rules are applied automatically from the server clock, and HR gets live views, approvals and one-click CSV registers.

> v1 ran as a single-file claude.ai artifact (pilot). This repository is **v2**, the standalone portal built from the PRD.

---

## ✨ Features

<table>
<tr><td valign="top" width="50%">

### 👤 For everyone
- **Clock in / out** on the server clock (IST): Office, WFH, Remote or Meeting/Event (with a note)
- **Live clock card**: elapsed timer, late chip, progress through the day
- **Today's tasks**: statuses *Not started / In progress / On hold / Blocked / Completed*; unfinished tasks **carry over** automatically
- **Tasks assigned by HR** appear with a *from …* tag
- **Daily numbers**: role-based counters (calls, demos, MoUs, sign-ups…)
- **Blockers**: flag one, and the senior sees it instantly
- **End-of-day summary** is required before clocking out
- **My attendance**: colour-coded month calendar; tap any day to plan it, fill a missed day or take leave
- **Leave**: balances (casual / earned / LWP), multi-day or half-day requests, cancel future leave
- **Weekly goals**: 3–5 targets, auto-linked to daily numbers or +/−, Friday self-review, senior feedback
- **My profile**: register-of-employees fields, photo, addresses, emergency contacts, completion meter
- **Reminders** by email and browser push
- **Light, dark and auto** themes · works on phones (bottom bar + menu)

</td><td valign="top" width="50%">

### 🧑‍💼 For HR & superadmins
- **Team overview** (live): who's in, late, missing or on leave; rings; filters; *Needs your attention*
- **Attendance sheet** (muster roll): people × days, late marks, ½-day flags, output totals, copy to Google Sheets
- **HR desk**: approve/reject leave with a comment, review past-day edits (reject = revert), convert absences, balances, HR to-do
- **Assign tasks** to one person or many, track status, withdraw
- **Spot checks**: "Seen" / "Not in" (Not in = absent)
- **Person pages**: excuse late marks, correct times, full day-by-day history
- **Weekly reviews**: status + feedback per person
- **Employee records**: employment details, appointment letters, profile completeness
- **CSV registers**: employees, muster roll, attendance, leave, overtime, **payroll summary**
- **Compliance tracker**: Maharashtra S&E, labour codes, MLWF, PT, ESIC, POSH, EPF… with thresholds
- **Settings**: rules, working days, holidays, Gamesdays, roster, sign-ups, accounts, reminders
- **Audit log** of every HR action

</td></tr>
</table>

---

## 📸 Screenshots

| Home (light) | Team overview (dark) |
|---|---|
| ![Home](docs/screenshots/home-light.jpg) | ![Team overview](docs/screenshots/team-dark.jpg) |
| **HR desk: approvals & assigned tasks** | **Attendance sheet (muster roll)** |
| ![HR desk](docs/screenshots/hr-desk.jpg) | ![Sheet](docs/screenshots/sheet-dark.jpg) |
| **My attendance: calendar & day editor** | **My profile: register of employees** |
| ![Attendance](docs/screenshots/attendance.jpg) | ![Profile](docs/screenshots/profile.jpg) |

<p align="center"><img src="docs/screenshots/mobile-home.jpg" alt="Mobile home" width="260" /><br/><sub>Phone layout (390&nbsp;px), no horizontal scroll on any page</sub></p>

---

## 🔐 Roles & permissions

Everyone clocks in, **including HR and superadmins**. People with HR access choose **HR** at sign-in (plus an authenticator code) to get the extra pages, or **Employee** to use it like anyone else.

| Capability | Employee | HR | Superadmin |
|---|:-:|:-:|:-:|
| Own clock-in, tasks, leave, goals, profile | ✅ | ✅ | ✅ |
| View Team overview, attendance sheet, weekly reviews, person pages | ✅ | ✅ | ✅ |
| See others' personal records (DOB, addresses, wages…) | ❌ | ✅ | ✅ |
| Approve leave, review edits, spot checks, corrections, assign tasks | ❌ | ✅ | ✅ |
| Employee records, compliance, settings, CSV registers | ❌ | ✅ | ✅ |
| Reset an **employee's** password | ❌ | ✅ | ✅ |
| Give / remove **HR or superadmin** access | ❌ | ❌ | ✅ |
| Reset an HR account's password / 2-step / unlink it | ❌ | ❌ | ✅ |

**Current team** (`scripts/roster-data.ts`)

| Role | People |
|---|---|
| Superadmin | Suketu (ZET-001), Harsh (ZET-002) |
| HR | Sagar, Krish, Shama |
| Employee | Aditya, Chitra, Kavi, Khushi, Namya, Pranav, Puneet, Radhika, Shashank, Vritee |

Safeguards: there is always at least one superadmin, nobody can remove their own access, and HR/superadmin entries can only be claimed **by email**, never by employee code.

---

## 🏗 Architecture

```mermaid
flowchart LR
    subgraph Client["Browser / phone (PWA)"]
        UI["React 19 client components<br/>Home · Team · HR"]
        SW["Service worker<br/>push notifications"]
    end

    subgraph Vercel["Vercel · region sin1 (Singapore)"]
        RSC["Server components<br/>(pages: read data)"]
        SA["Server actions<br/>(every write · session + role checks)"]
        API1["/api/registers/[kind]<br/>CSV registers (HR)"]
        API2["/api/cron/reminders<br/>(secret-protected)"]
        RULES["lib/rules.ts<br/>rules engine (pure)"]
    end

    subgraph Data["Neon · ap-southeast-1"]
        PG[("PostgreSQL 18<br/>pooled connection")]
    end

    GHA["GitHub Actions<br/>every 15 min, 08:30–21:00 IST"]
    SMTP["SMTP<br/>(email reminders)"]
    PUSH["Web Push<br/>(VAPID)"]

    UI -- "navigate" --> RSC
    UI -- "mutations" --> SA
    RSC --> RULES
    API1 --> RULES
    RSC & SA & API1 & API2 -- "Drizzle ORM" --> PG
    GHA -- "Bearer CRON_SECRET" --> API2
    API2 --> SMTP
    API2 --> PUSH
    SA -- "approvals, assigned tasks" --> PUSH
    PUSH --> SW
```

**Principles**

- **The server is the only database client.** There is no client-side database access, so access control lives in one place: `requireUser` / `requireHr` for pages, and `actionUser` / `actionHr` plus superadmin checks for actions.
- **One rules engine.** Every screen and every register uses the same pure functions in `lib/rules.ts`, so numbers can't disagree.
- **Server time only.** Check-in and check-out use the database `now()` in IST; the device clock is never trusted.
- **History is stable.** A late mark is frozen when the check-in is written, so a later rule change can't rewrite last month.
- **Small-team pragmatism.** The team is about 15–20 people, so pages load the whole team's month or leave year in one query, with no caching layers to keep in sync.

---

## 🗃 Data model

```mermaid
erDiagram
    PEOPLE ||--o{ SESSIONS : "signs in"
    PEOPLE ||--o{ DAY_LOGS : "one per day"
    PEOPLE ||--o{ LEAVES : requests
    PEOPLE ||--o{ WEEKS : "weekly goals"
    PEOPLE ||--o| HR_RECORDS : "personal + job"
    PEOPLE ||--o{ PUSH_SUBS : devices
    PEOPLE ||--o{ REMINDER_LOG : "reminded"
    PEOPLE ||--o{ AUDIT_LOG : "acts"

    PEOPLE {
        serial id PK
        text emp_no UK "ZET-NNN, never reused"
        text full_name
        text role
        text type "hybrid | remote | part"
        text_array metrics
        text status "pending | active | left"
        bool is_hr
        bool is_superadmin
        text email UK
        text password_hash "scrypt"
        text totp_secret
        text photo "192px JPEG"
    }
    DAY_LOGS {
        int person_id PK
        date date PK
        text mode "office | wfh | remote | meeting"
        timestamptz check_in_at
        timestamptz check_out_at
        text late_status "frozen at check-in"
        jsonb plan "tasks incl. assignedBy"
        text eod "summary"
        jsonb blocker
        jsonb metrics
        text spot "yes | no"
        jsonb edit "reason, status, prev snapshot"
    }
    LEAVES {
        serial id PK
        int person_id FK
        date date
        bool half
        text kind "casual | earned | lwp"
        text status "pending | approved | rejected | cancelled"
        timestamptz applied_at "planned vs unplanned"
        text hr_comment
    }
    WEEKS {
        int person_id PK
        date monday PK
        jsonb targets
        text self_review
        text senior_status
        text senior_comment
    }
    HR_RECORDS {
        int person_id PK
        jsonb personal "DOB, addresses, emergency contacts"
        jsonb job "designation, DOJ, wages, UAN, appointment letter"
    }
    SESSIONS {
        text id PK "sha256(cookie)"
        int person_id FK
        text role "employee | hr"
        bool mfa_ok
        timestamptz expires_at "12 h"
    }
```

Also: `app_config` (settings and compliance documents), `audit_log`, `push_subs`, `reminder_log`. Migrations live in [`drizzle/`](drizzle).

---

## 🔁 Key flows

### Sign-in

```mermaid
sequenceDiagram
    autonumber
    actor U as Person
    participant S as Sign-in page
    participant A as Server action
    participant DB as Postgres
    U->>S: Email or ZET code + password (+ Employee/HR)
    S->>A: signIn()
    A->>DB: find person · verify scrypt hash
    alt Employee
        A->>DB: create 12 h session (httpOnly cookie)
        A-->>U: → Home (or Change password if HR reset it)
    else HR / Superadmin
        A->>DB: create session (mfa pending)
        A-->>U: → 2-step page (QR on first use)
        U->>A: 6-digit authenticator code
        A->>DB: verify TOTP · mark session ok
        A-->>U: → Home
    end
```

### A working day

```mermaid
flowchart LR
    A([Clock in<br/>server time]) --> B{After 10:15?}
    B -- no --> C[On time]
    B -- "10:16–11:00" --> D[Late mark]
    B -- "after 11:00" --> E[Half day cut]
    C & D & E --> F[Add tasks by 11:00<br/>+ carried over + assigned]
    F --> G[Update statuses,<br/>numbers, blockers]
    G --> H[Summary ≥ 10 chars]
    H --> I([Clock out])
```

### Leave request

```mermaid
stateDiagram-v2
    [*] --> Pending: employee applies<br/>(counts against balance at once)
    Pending --> Approved: HR approves (+ comment)
    Pending --> Rejected: HR rejects (+ comment)
    Pending --> Cancelled: employee cancels
    Approved --> Cancelled: employee cancels (future dates)
    Rejected --> [*]: day counted normally (absent if no check-in)
    Approved --> [*]
    note right of Pending
        applied ≥ 1 day ahead → planned
        on the day → unplanned (flagged)
    end note
```

### Past-day edit review

```mermaid
stateDiagram-v2
    [*] --> Pending: employee edits a past day<br/>(applies now, snapshot saved)
    Pending --> Approved: HR accepts
    Pending --> Rejected: HR rejects → snapshot restored
    Approved --> [*]
    Rejected --> [*]
```

---

## 📐 The rules engine

All in [`lib/rules.ts`](lib/rules.ts), covered by [`tests/rules.test.ts`](tests/rules.test.ts). HR edits every number in **Settings**; the **Rules** page re-renders from those settings.

| # | Rule | Default |
|---|---|---|
| R1 | Times come from the server clock (IST) | — |
| R2 | **Late mark**: check-in after start + grace on a working day (Office, and WFH/Remote if enabled). Part-time and Meeting/Event are exempt | 10:00 + 15 min |
| R3 | Every N late marks in a calendar month = **½ day** leave cut | 3 |
| R4 | Check-in more than X min after start = **½ day** that day | 60 min |
| R5 | Every 3 missed end-of-day summaries = 1 late mark | 3 |
| R6 | Late marks reset monthly; HR can **excuse** one | — |
| R7 | Working day with no check-in and no leave = **absent** (1 day unplanned) | — |
| R8 | Cuts and absences consume **casual → earned → LWP** | — |
| R9 | Leave applied ≥ 1 day ahead = planned | — |
| R10 | Hybrid office target; Meeting/Event and Gamesday count as office | 3 days/week |
| R11 | Overtime beyond X h/day; weekly max | 9 h · 48 h |
| R12 | Holidays & Gamesdays are never absent; weekends shaded | Mon–Fri |
| R13 | Nothing counts before the go-live date | 16-11-2026 |
| R14 | Past-day edits need a reason; HR approves or rejects (revert) | — |
| R15 | Leave year from April; balance = entitlement + EL brought forward − availed | 8 CL · 18 EL |

---

## 🧰 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, server actions, Turbopack) | One deployable app; server-side authorisation |
| UI | **React 19**, v1's hand-tuned CSS (Jost, brand tokens, light/dark) | Same look as the pilot; no CSS framework |
| Database | **Neon Postgres 18** (pooled) | Managed, serverless, Singapore region |
| ORM | **Drizzle** + `node-postgres` | Typed SQL, plain migrations |
| Auth | Email/code + **scrypt** passwords, DB sessions, **TOTP** for HR | No third-party identity provider needed |
| Notifications | **Nodemailer** (any SMTP) + **web-push** (VAPID) | Email + browser push |
| Scheduling | **GitHub Actions** cron → `/api/cron/reminders` | Works on Vercel Hobby |
| Tests | **Vitest** (rules) + **Playwright** (199 end-to-end checks) | Rules proven; flows proven |
| Hosting | **Vercel** (`sin1`) | Next.js-native, close to Neon |

---

## 🚀 Getting started

**Prerequisites:** Node 20+ (tested on 22 and 25), Docker (for a local Postgres) or a Neon branch.

```bash
git clone https://github.com/1iamharshraj/Zetheta-daily-muster.git
cd Zetheta-daily-muster
npm install

# local database
docker run -d --name muster-pg -e POSTGRES_PASSWORD=muster -e POSTGRES_DB=muster \
  -p 54329:5432 postgres:17-alpine

cp .env.example .env.local
# .env.local → DATABASE_URL=postgres://postgres:muster@localhost:54329/muster

npm run db:migrate
npm run db:seed        # demo copy of the roster with two weeks of history
npm run dev            # http://localhost:3000
```

**Demo logins** (local seed only): `<first name>@example.com` / `muster-dev-1`.
For example `harsh@example.com` (superadmin), `krish@example.com` (HR) or `puneet@example.com` (employee).
HR sign-in asks you to scan a QR code with Google or Microsoft Authenticator the first time.

> ⚠️ `npm run db:seed -- --force` **wipes every table**. Never point it at production.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (rules engine & acceptance criteria) |
| `npm run test:e2e` | End-to-end suite (local DB only, see [Testing](#-testing)) |
| `npm run db:generate` | New migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Demo data (local only) |
| `npm run roster` | Load the real team into any DB (insert-only, idempotent) |

---

## ☁️ Deployment

```mermaid
flowchart LR
    Dev["git push main"] --> GH["GitHub"]
    GH --> CI["CI: typecheck · unit tests · build"]
    GH --> V["Vercel build & deploy (sin1)"]
    V --> N[("Neon Postgres")]
    GHA["GitHub Actions cron"] -->|every 15 min| V
```

1. **Database.** Create a Neon project (Singapore) and copy the **pooled** connection string. Then:
   ```bash
   DATABASE_URL="<neon url>" npm run db:migrate
   DATABASE_URL="<neon url>" npm run roster -- --email Suketu=<email> --email Harsh=<email> --issue-passwords Suketu,Harsh
   ```
   `--issue-passwords` prints one-time passwords; people sign in with their **employee code** and must choose their own password.
2. **Vercel.** Import the repo and set the [environment variables](#-configuration). `vercel.json` pins functions to `sin1` (next to Neon).
3. **Reminders.** In GitHub, under *Settings → Secrets and variables → Actions*, add `APP_URL` and `CRON_SECRET`. The `Reminders` workflow then calls the app every 15 minutes, 08:30–21:00 IST, Mon–Sat. (Vercel Hobby allows only a daily cron; on Pro you could use Vercel Cron instead.)
4. **Push notifications** (optional). Run `npx web-push generate-vapid-keys`, then set the three VAPID variables.
5. **Email** (optional). Set the SMTP variables, e.g. a Google Workspace app password.
6. **First run.** A superadmin signs in as **HR**, checks *Settings → Rules* (go-live date, holidays), and adds emails for anyone who'll sign in with one.

---

## ⚙️ Configuration

| Variable | Required | Description |
|---|:-:|---|
| `DATABASE_URL` | ✅ | Neon pooled URL (`…-pooler…/neondb?sslmode=verify-full`) |
| `CRON_SECRET` | ✅ | Long random string; the reminders endpoint requires it |
| `APP_URL` | ✅ | Public URL, used in email links |
| `HR_EMAILS` | — | Comma-separated emails that get HR the moment they create a password (bootstrap) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `MAIL_FROM` | — | Email reminders and notifications |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` | — | Browser push |

App-level settings (hours, grace, leave, holidays, working days, reminder channels) live in the database and are edited in **Settings**.

---

## 🛠 Operations runbook

| Task | How |
|---|---|
| Add a person | *Settings → Team → Add person* (gets the next ZET code). They choose **First time here?** with that email, or HR issues a one-time password |
| Someone forgot their password | *Settings → Accounts → Reset password*: a one-time password is shown once and they must change it |
| HR lost their phone | A superadmin uses *Reset 2-step*; they scan a new QR at the next HR sign-in |
| Someone leaves | Untick **Active** in *Settings → Team* (history is kept; sign-in is blocked) |
| Give HR access | Superadmin: *Settings → Team → More → HR access* |
| Change rules / holidays | *Settings → Rules* (changes don't rewrite past late marks) |
| Monthly registers | *Employee records* or *Compliance* → download CSVs |
| Check reminders ran | GitHub → *Actions → Reminders* (JSON lists who was reminded) |
| Who changed what | `audit_log` table (every HR action, with before/after) |
| Backups | Neon point-in-time restore; see [Roadmap](#-roadmap) for long-term retention |

---

## 🧪 Testing

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm test` | Late marks, half-day cuts, severe late, absences, leave order, planned/unplanned, frozen late status, date parsing, title-aware names |
| End-to-end | `npm run test:e2e` | **199 checks across 14 sections**: sign-in & 2-step, registration & linking, clock/tasks/numbers/blockers, leave + approvals, calendar editor + edit review, goals, profile validation (AC8–AC11), team pages, HR desk, assignments, spot checks, corrections, records, all six registers (AC13), compliance, settings, roster, superadmin limits, reminders, themes, 390 px layout (AC14), and zero browser errors |
| CI | GitHub Actions on every push | Type-check, unit tests, production build |

Run the end-to-end suite **only against a local database**; it refuses Neon URLs.

```bash
DATABASE_URL=postgres://postgres:muster@localhost:54329/muster npm run db:seed -- --force
DATABASE_URL=postgres://postgres:muster@localhost:54329/muster CRON_SECRET=dev-secret npm run dev
npm run test:e2e        # report + screenshots in e2e/out/
```

PRD acceptance criteria: AC1–AC14 are all covered (AC2 HR 2-step, AC3–AC5 rules, AC6 summary gate, AC7 access via the API, AC8–AC10 profile validation, AC11 titles, AC12 photo, AC13 registers, AC14 phone layout).

---

## 📁 Project structure

```
app/
├─ (auth)/            sign-in, 2-step verification, pending, forced password change
├─ (app)/             signed-in pages (shared shell)
│  ├─ home/  attendance/  leave/  goals/  profile/
│  ├─ team/  team/[id]/  sheet/  reviews/  rules/
│  └─ hr/  hr/records/  hr/compliance/  hr/settings/
├─ actions/           server actions: auth · day · week · hr · profile · settings · push
├─ api/registers/     CSV registers
├─ api/cron/          reminders
├─ v1.css · extra.css design system (v1 tokens + v2 additions, light/dark)
components/           Shell (sidebar), AttendanceView, ProfileForm, AssignTask, ThemeSwitch, ui…
lib/
├─ rules.ts           rules engine (pure, tested)
├─ db/schema.ts       Drizzle schema
├─ auth.ts crypto.ts  sessions, scrypt, TOTP
├─ data.ts day.ts     loaders & day helpers
└─ notify.ts          email + push
scripts/              migrate · seed (demo) · roster (real team)
drizzle/              SQL migrations
e2e/                  end-to-end suite
.github/workflows/    CI + reminders schedule
```

---

## 🛡 Security & privacy

- **Authorisation on the server.** Every page and action checks the session and role. Employees can't reach HR pages or registers (verified in the end-to-end suite via the API, not only the UI).
- **Passwords**: scrypt (N=16384, r=8) with per-user salt; a 1-second delay after each failed attempt.
- **Sessions**: random 256-bit tokens; only their SHA-256 is stored; httpOnly, `SameSite=Lax`, `Secure` in production; 12-hour expiry; other sessions end on password change.
- **HR 2-step**: TOTP (RFC 6238); superadmins can reset it.
- **Account takeover guards**: HR/superadmin entries link by email only; HR rights are re-checked on every request; there is always at least one superadmin.
- **Server actions**: built-in origin checks (CSRF); input is validated and length-limited.
- **Privacy (DPDP Act 2023)**: personal details are visible only to the person and HR. No Aadhaar, PAN or bank numbers are stored (the UI says so).
- **Audit log** of HR actions with before/after.
- **Secrets**: `.env*` and `team-logins.md` are git-ignored; the e2e suite refuses to run against Neon.

---

## ⚡ Performance

Measured during development (15 people, full leave year of data):

| | Value |
|---|---|
| Neon round trip from India (dev machine) | ~45 ms |
| Neon round trip from Vercel `sin1` | ~1–3 ms (same region) |
| Heaviest query (whole team, whole leave year) | ~46 ms from India |
| Page render, local dev server | ~0.6 s (sheet ~1.1 s, dev mode) |
| Neon cold start after auto-suspend | ~1 s on the first request (the 15-min reminders ping keeps it warm during work hours) |

The PRD targets (first load < 3 s on 4G, team overview < 2 s) are comfortably within reach with Vercel in `sin1`.

---

## 🧭 Decisions & deviations from the PRD

| PRD | v2 | Why |
|---|---|---|
| Supabase + RLS | **Neon + server-only DB access** | Same guarantee (AC7) with one access layer |
| Google sign-in | **Email / employee code + password** | Team preference; some staff have no company email |
| Test mode | **Removed** | A security hole in a real portal |
| Leave auto-recorded | **HR approves**; pending counts against the balance | Open question 1, resolved |
| — | **Superadmin** role | Two personal logins manage HR access |
| — | **Spot checks** kept from v1 | Missing from the PRD |
| — | **HR-assigned tasks** | Requested by the team |
| — | **Payroll summary CSV** | P2 item, cheap with the rules engine |
| Vercel Cron | **GitHub Actions** schedule | Vercel Hobby allows daily crons only |

---

## 🗺 Roadmap

**Next up**
- [ ] Deploy to Vercel (`sin1`) and set the GitHub reminder secrets
- [ ] Fill roles and work patterns for every person (*Settings → Team*)
- [ ] Import v1 pilot data (needs a JSON export from the v1 artifact; keep employee codes)

**Improvements found during testing**
- [ ] **Sign-in rate limiting** per account/IP (today: 1 s delay per failed attempt)
- [ ] **Audit log viewer** for HR (data is recorded, but there's no page yet)
- [ ] **Team leave calendar** and **bulk approve** on the HR desk
- [ ] **Assigned tasks**: due time, priority, recurring tasks, comments
- [ ] **Weekend/holiday check-ins**: decide whether to block them or record them as overtime/comp-off
- [ ] **Notification retries** and a delivery log (email/push are fire-and-forget today)
- [ ] **Long-term backups**: nightly `pg_dump` to storage for the 5-year retention requirement (Neon PITR is short)
- [ ] **iOS push** needs the app added to the Home Screen; add an in-app install prompt
- [ ] **Document uploads** (appointment letters, signed policies), PRD P2
- [ ] **Integrations**: Google Calendar (auto Meeting/Event), payroll provider (P3)
- [ ] Accessibility audit (contrast in dark mode, screen-reader pass)

---

<div align="center">
<sub>Built for Zetheta Algorithms Pvt. Ltd. · Andheri (W), Mumbai · Internal use only</sub>
</div>
