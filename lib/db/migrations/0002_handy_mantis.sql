CREATE TABLE "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempt_count" integer NOT NULL,
	CONSTRAINT "login_attempts_count_positive_check" CHECK ("login_attempts"."attempt_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_expiry_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "login_attempts_window_idx" ON "login_attempts" USING btree ("window_started_at");