import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "recruiter",
  "admin",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "published",
  "closed",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "Applied",
  "Under Review",
  "Shortlisted",
  "Interview Scheduled",
  "Waiting for Result",
  "Selected",
  "Rejected",
  "Withdrawn",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    industry: text("industry").notNull(),
    location: text("location").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("companies_name_unique").on(table.name)],
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    studentNumber: text("student_number").notNull(),
    fullName: text("full_name").notNull(),
    course: text("course").notNull(),
    department: text("department").notNull(),
    graduationYear: integer("graduation_year").notNull(),
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }).notNull(),
    skills: text("skills").array().notNull().default([]),
    interests: text("interests").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("student_profiles_student_number_unique").on(
      table.studentNumber,
    ),
    check(
      "student_profiles_student_number_format_check",
      sql`${table.studentNumber} ~ '^PM-[0-9]{5,}$'`,
    ),
    check(
      "student_profiles_graduation_year_range_check",
      sql`${table.graduationYear} BETWEEN 2000 AND 2099`,
    ),
    index("student_profiles_department_year_idx").on(
      table.department,
      table.graduationYear,
    ),
  ],
);

export const studentNumberCounters = pgTable(
  "student_number_counters",
  {
    graduationYear: integer("graduation_year").primaryKey(),
    lastIssued: integer("last_issued").notNull(),
  },
  (table) => [
    check(
      "student_number_counters_graduation_year_check",
      sql`${table.graduationYear} BETWEEN 2000 AND 2099`,
    ),
    check(
      "student_number_counters_last_issued_check",
      sql`${table.lastIssued} > 0`,
    ),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("auth_sessions_user_expiry_idx").on(table.userId, table.expiresAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    attemptCount: integer("attempt_count").notNull(),
  },
  (table) => [
    check("login_attempts_count_positive_check", sql`${table.attemptCount} > 0`),
    index("login_attempts_window_idx").on(table.windowStartedAt),
  ],
);

export const recruiterProfiles = pgTable(
  "recruiter_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("recruiter_profiles_company_idx").on(table.companyId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    location: text("location").notNull(),
    category: text("category").notNull(),
    packageLpa: numeric("package_lpa", { precision: 8, scale: 2 }).notNull(),
    description: text("description").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    graduationYear: integer("graduation_year").notNull(),
    minimumCgpa: numeric("minimum_cgpa", { precision: 4, scale: 2 }).notNull(),
    eligibleCourses: text("eligible_courses").array().notNull().default([]),
    requiredSkills: text("required_skills").array().notNull().default([]),
    optionalSkills: text("optional_skills").array().notNull().default([]),
    status: jobStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobs_status_deadline_idx").on(table.status, table.deadline),
    index("jobs_company_idx").on(table.companyId),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "restrict" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    status: applicationStatusEnum("status").notNull().default("Applied"),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("applications_student_job_unique").on(
      table.studentId,
      table.jobId,
    ),
    index("applications_student_applied_idx").on(
      table.studentId,
      table.appliedAt,
    ),
    index("applications_job_status_idx").on(table.jobId, table.status),
  ],
);

export const applicationStatusHistory = pgTable(
  "application_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    previousStatus: applicationStatusEnum("previous_status"),
    status: applicationStatusEnum("status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("application_history_application_changed_idx").on(
      table.applicationId,
      table.changedAt,
    ),
  ],
);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    scheduledBy: uuid("scheduled_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    interviewType: text("interview_type").notNull(),
    location: text("location").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("interviews_application_start_idx").on(
      table.applicationId,
      table.startsAt,
    ),
  ],
);

export const resumeReviews = pgTable(
  "resume_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    score: integer("score"),
    feedback: text("feedback").notNull(),
    isRuleBased: boolean("is_rule_based").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resume_reviews_student_created_idx").on(
      table.studentId,
      table.createdAt,
    ),
  ],
);

export const studentSegments = pgTable(
  "student_segments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    rules: jsonb("rules").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("student_segments_name_unique").on(table.name)],
);

export type NewStudentProfile = Omit<
  typeof studentProfiles.$inferInsert,
  "studentNumber"
>;
