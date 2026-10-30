CREATE TABLE "student_number_counters" (
	"graduation_year" integer PRIMARY KEY NOT NULL,
	"last_issued" integer NOT NULL,
	CONSTRAINT "student_number_counters_graduation_year_check" CHECK ("student_number_counters"."graduation_year" BETWEEN 2000 AND 2099),
	CONSTRAINT "student_number_counters_last_issued_check" CHECK ("student_number_counters"."last_issued" > 0)
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "student_number" text;
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_graduation_year_range_check" CHECK ("student_profiles"."graduation_year" BETWEEN 2000 AND 2099);
--> statement-breakpoint
WITH numbered_profiles AS (
	SELECT
		"user_id",
		"graduation_year",
		row_number() OVER (
			PARTITION BY "graduation_year"
			ORDER BY "user_id"
		) AS sequence_number
	FROM "student_profiles"
)
UPDATE "student_profiles" AS profile
SET "student_number" =
	'PM-' || right(numbered_profiles."graduation_year"::text, 2)
	|| lpad(
		numbered_profiles.sequence_number::text,
		GREATEST(3, length(numbered_profiles.sequence_number::text)),
		'0'
	)
FROM numbered_profiles
WHERE profile."user_id" = numbered_profiles."user_id";
--> statement-breakpoint
INSERT INTO "student_number_counters" ("graduation_year", "last_issued")
SELECT "graduation_year", max(substring("student_number" FROM 6)::integer)
FROM "student_profiles"
GROUP BY "graduation_year";
--> statement-breakpoint
ALTER TABLE "student_profiles" ALTER COLUMN "student_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_student_number_unique" ON "student_profiles" USING btree ("student_number");
--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_number_format_check" CHECK ("student_profiles"."student_number" ~ '^PM-[0-9]{5,}$');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.assign_student_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	sequence_number integer;
BEGIN
	IF NEW.graduation_year < 2000 OR NEW.graduation_year > 2099 THEN
		RAISE EXCEPTION 'graduation_year must be between 2000 and 2099'
			USING ERRCODE = '23514';
	END IF;

	INSERT INTO public.student_number_counters (graduation_year, last_issued)
	VALUES (NEW.graduation_year, 1)
	ON CONFLICT (graduation_year)
	DO UPDATE SET last_issued = student_number_counters.last_issued + 1
	RETURNING last_issued INTO sequence_number;

	NEW.student_number :=
		'PM-' || right(NEW.graduation_year::text, 2)
		|| lpad(
			sequence_number::text,
			GREATEST(3, length(sequence_number::text)),
			'0'
		);

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER student_profiles_assign_student_number
BEFORE INSERT ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_student_number();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_student_number_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.student_number IS DISTINCT FROM OLD.student_number THEN
		RAISE EXCEPTION 'student_number cannot be changed after creation'
			USING ERRCODE = '23514';
	END IF;

	IF NEW.graduation_year IS DISTINCT FROM OLD.graduation_year THEN
		RAISE EXCEPTION 'graduation_year cannot be changed after student number assignment'
			USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER student_profiles_prevent_number_or_cohort_change
BEFORE UPDATE OF student_number, graduation_year ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_student_number_change();
