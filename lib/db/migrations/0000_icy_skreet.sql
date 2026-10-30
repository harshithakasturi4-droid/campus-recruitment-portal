CREATE TYPE "public"."application_status" AS ENUM('Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Waiting for Result', 'Selected', 'Rejected', 'Withdrawn');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'recruiter', 'admin');--> statement-breakpoint
CREATE TABLE "application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"previous_status" "application_status",
	"status" "application_status" NOT NULL,
	"changed_by" uuid,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'Applied' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"location" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"scheduled_by" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"interview_type" text NOT NULL,
	"location" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"category" text NOT NULL,
	"package_lpa" numeric(8, 2) NOT NULL,
	"description" text NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"graduation_year" integer NOT NULL,
	"minimum_cgpa" numeric(4, 2) NOT NULL,
	"eligible_courses" text[] DEFAULT '{}' NOT NULL,
	"required_skills" text[] DEFAULT '{}' NOT NULL,
	"optional_skills" text[] DEFAULT '{}' NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"score" integer,
	"feedback" text NOT NULL,
	"is_rule_based" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"course" text NOT NULL,
	"department" text NOT NULL,
	"graduation_year" integer NOT NULL,
	"cgpa" numeric(4, 2) NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_reviews" ADD CONSTRAINT "resume_reviews_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_reviews" ADD CONSTRAINT "resume_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_segments" ADD CONSTRAINT "student_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_history_application_changed_idx" ON "application_status_history" USING btree ("application_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_student_job_unique" ON "applications" USING btree ("student_id","job_id");--> statement-breakpoint
CREATE INDEX "applications_student_applied_idx" ON "applications" USING btree ("student_id","applied_at");--> statement-breakpoint
CREATE INDEX "applications_job_status_idx" ON "applications" USING btree ("job_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_name_unique" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "interviews_application_start_idx" ON "interviews" USING btree ("application_id","starts_at");--> statement-breakpoint
CREATE INDEX "jobs_status_deadline_idx" ON "jobs" USING btree ("status","deadline");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "recruiter_profiles_company_idx" ON "recruiter_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "resume_reviews_student_created_idx" ON "resume_reviews" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "student_profiles_department_year_idx" ON "student_profiles" USING btree ("department","graduation_year");--> statement-breakpoint
CREATE UNIQUE INDEX "student_segments_name_unique" ON "student_segments" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");