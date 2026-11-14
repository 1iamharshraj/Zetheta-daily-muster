CREATE SEQUENCE "public"."emp_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"target_id" integer,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_logs" (
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"mode" text,
	"intent" text,
	"check_in_at" timestamp with time zone,
	"check_in_src" text,
	"check_out_at" timestamp with time zone,
	"check_out_src" text,
	"late_mins" integer,
	"late_status" text,
	"late_excused" boolean DEFAULT false NOT NULL,
	"meeting_note" text,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eod" text,
	"blocker" jsonb,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"spot" text,
	"edit" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_logs_person_id_date_pk" PRIMARY KEY("person_id","date")
);
--> statement-breakpoint
CREATE TABLE "hr_records" (
	"person_id" integer PRIMARY KEY NOT NULL,
	"personal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"job" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"half" boolean DEFAULT false NOT NULL,
	"kind" text DEFAULT 'casual' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'employee' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"hr_comment" text
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"emp_no" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'hybrid' NOT NULL,
	"metrics" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_hr" boolean DEFAULT false NOT NULL,
	"email" text,
	"password_hash" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"totp_on" boolean DEFAULT false NOT NULL,
	"photo" text,
	"guide_seen" boolean DEFAULT false NOT NULL,
	"last_sign_in" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_emp_no_unique" UNIQUE("emp_no")
);
--> statement-breakpoint
CREATE TABLE "push_subs" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"person_id" integer NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_person_id_date_kind_pk" PRIMARY KEY("person_id","date","kind")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"role" text NOT NULL,
	"mfa_ok" boolean DEFAULT true NOT NULL,
	"totp_setup" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"person_id" integer NOT NULL,
	"monday" date NOT NULL,
	"targets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"self_review" text DEFAULT '' NOT NULL,
	"senior_status" text,
	"senior_comment" text,
	"senior_by" integer,
	"senior_at" timestamp with time zone,
	CONSTRAINT "weeks_person_id_monday_pk" PRIMARY KEY("person_id","monday")
);
--> statement-breakpoint
ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subs" ADD CONSTRAINT "push_subs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "day_logs_date_idx" ON "day_logs" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "leaves_live_uq" ON "leaves" USING btree ("person_id","date") WHERE status in ('pending','approved');--> statement-breakpoint
CREATE INDEX "leaves_date_idx" ON "leaves" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_uq" ON "people" USING btree (lower("email"));