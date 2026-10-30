import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  applicationStatusHistory,
  applications,
  companies,
  db,
  interviews,
  jobs,
  studentProfiles,
  users,
} from "@workspace/db";
import { requireRecruiter, verifyCsrf } from "../lib/security";

const router = Router();
router.use(requireRecruiter);

const jobCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(80),
  package: z.coerce.number().positive(),
  deadline: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  year: z.coerce.number().int().min(2000).max(2099).default(2026),
  minCgpa: z.coerce.number().min(0).max(10).default(0),
  courses: z.array(z.string().trim()).default([]),
  skills: z.array(z.string().trim()).min(1),
  optionalSkills: z.array(z.string().trim()).default([]),
  description: z.string().trim().min(10),
  status: z.enum(["draft", "published", "closed"]).default("published"),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    "Applied",
    "Under Review",
    "Shortlisted",
    "Interview Scheduled",
    "Waiting for Result",
    "Selected",
    "Rejected",
    "Withdrawn",
  ]),
  note: z.string().trim().max(500).optional(),
});

const interviewScheduleSchema = z.object({
  applicationId: z.string().uuid(),
  startsAt: z.string().datetime().or(z.string().min(10)),
  type: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(500).optional(),
});

// 1. Company profile
router.get("/recruiter/company", async (request, response, next) => {
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, request.recruiter!.companyId))
      .limit(1);
    if (!company) {
      response.status(404).json({ error: "Company not found." });
      return;
    }
    response.json({ company });
  } catch (error) {
    next(error);
  }
});

router.patch("/recruiter/company", verifyCsrf, async (request, response, next) => {
  try {
    const patchSchema = z.object({
      industry: z.string().trim().min(2).max(100).optional(),
      location: z.string().trim().min(2).max(100).optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid company payload." });
      return;
    }
    const [updated] = await db
      .update(companies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(companies.id, request.recruiter!.companyId))
      .returning();
    response.json({ company: updated });
  } catch (error) {
    next(error);
  }
});

// 2. Jobs management
router.get("/recruiter/jobs", async (request, response, next) => {
  try {
    const companyJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        location: jobs.location,
        category: jobs.category,
        package: jobs.packageLpa,
        deadline: jobs.deadline,
        year: jobs.graduationYear,
        minCgpa: jobs.minimumCgpa,
        courses: jobs.eligibleCourses,
        skills: jobs.requiredSkills,
        description: jobs.description,
        status: jobs.status,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.companyId, request.recruiter!.companyId))
      .orderBy(desc(jobs.createdAt));

    const counts = await db
      .select({
        jobId: applications.jobId,
        applicantCount: sql<number>`count(*)::int`,
      })
      .from(applications)
      .groupBy(applications.jobId);

    const countsMap = new Map(counts.map((c) => [c.jobId, c.applicantCount]));

    response.json({
      jobs: companyJobs.map((j) => ({
        ...j,
        package: Number(j.package),
        minCgpa: Number(j.minCgpa),
        deadline: j.deadline.toISOString().split("T")[0],
        status: j.status === "published" ? "Open" : j.status === "draft" ? "Draft" : "Closed",
        applicantCount: countsMap.get(j.id) ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/recruiter/jobs", verifyCsrf, async (request, response, next) => {
  try {
    const parsed = jobCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Job details are invalid.", details: parsed.error.issues });
      return;
    }
    const [created] = await db
      .insert(jobs)
      .values({
        companyId: request.recruiter!.companyId,
        createdBy: request.recruiter!.id,
        title: parsed.data.title,
        location: parsed.data.location,
        category: parsed.data.category,
        packageLpa: parsed.data.package.toFixed(2),
        deadline: new Date(parsed.data.deadline),
        graduationYear: parsed.data.year,
        minimumCgpa: parsed.data.minCgpa.toFixed(2),
        eligibleCourses: parsed.data.courses,
        requiredSkills: parsed.data.skills,
        optionalSkills: parsed.data.optionalSkills,
        description: parsed.data.description,
        status: parsed.data.status,
      })
      .returning();

    response.status(201).json({ job: created });
  } catch (error) {
    next(error);
  }
});

router.patch("/recruiter/jobs/:id", verifyCsrf, async (request, response, next) => {
  try {
    const [existing] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, request.params.id), eq(jobs.companyId, request.recruiter!.companyId)))
      .limit(1);
    if (!existing) {
      response.status(404).json({ error: "Job posting not found." });
      return;
    }

    const patchSchema = jobCreateSchema.partial();
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Job update is invalid." });
      return;
    }

    const { package: pkg, minCgpa, deadline, ...rest } = parsed.data;
    const updateValues: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (pkg !== undefined) updateValues.packageLpa = pkg.toFixed(2);
    if (minCgpa !== undefined) updateValues.minimumCgpa = minCgpa.toFixed(2);
    if (deadline !== undefined) updateValues.deadline = new Date(deadline);

    const [updated] = await db
      .update(jobs)
      .set(updateValues)
      .where(eq(jobs.id, request.params.id))
      .returning();

    response.json({ job: updated });
  } catch (error) {
    next(error);
  }
});

// 3. Applicants pipeline
router.get("/recruiter/applicants", async (request, response, next) => {
  try {
    const companyJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.companyId, request.recruiter!.companyId));

    if (!companyJobs.length) {
      response.json({ applicants: [] });
      return;
    }

    const jobIds = companyJobs.map((j) => j.id);
    const rows = await db
      .select({
        applicationId: applications.id,
        status: applications.status,
        appliedAt: applications.appliedAt,
        jobId: applications.jobId,
        jobTitle: jobs.title,
        studentId: studentProfiles.userId,
        studentNumber: studentProfiles.studentNumber,
        studentName: studentProfiles.fullName,
        studentEmail: users.email,
        course: studentProfiles.course,
        department: studentProfiles.department,
        year: studentProfiles.graduationYear,
        cgpa: studentProfiles.cgpa,
        skills: studentProfiles.skills,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(studentProfiles, eq(applications.studentId, studentProfiles.userId))
      .innerJoin(users, eq(studentProfiles.userId, users.id))
      .where(inArray(applications.jobId, jobIds))
      .orderBy(desc(applications.appliedAt));

    response.json({
      applicants: rows.map((r) => ({
        ...r,
        cgpa: Number(r.cgpa),
        appliedAt: r.appliedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// 4. Update application status
router.patch("/recruiter/applications/:id/status", verifyCsrf, async (request, response, next) => {
  try {
    const parsed = statusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid application status." });
      return;
    }

    // Verify application belongs to recruiter's company
    const [app] = await db
      .select({
        id: applications.id,
        currentStatus: applications.status,
        companyId: jobs.companyId,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.id, request.params.id))
      .limit(1);

    if (!app || app.companyId !== request.recruiter!.companyId) {
      response.status(404).json({ error: "Application not found for your company." });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(applications)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(applications.id, app.id));

      await tx.insert(applicationStatusHistory).values({
        applicationId: app.id,
        previousStatus: app.currentStatus,
        status: parsed.data.status,
        changedBy: request.recruiter!.id,
        note: parsed.data.note || `Status updated to ${parsed.data.status}`,
      });
    });

    response.json({ success: true, status: parsed.data.status });
  } catch (error) {
    next(error);
  }
});

// 5. Schedule Interview
router.post("/recruiter/interviews", verifyCsrf, async (request, response, next) => {
  try {
    const parsed = interviewScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid interview schedule payload." });
      return;
    }

    const [created] = await db
      .insert(interviews)
      .values({
        applicationId: parsed.data.applicationId,
        scheduledBy: request.recruiter!.id,
        startsAt: new Date(parsed.data.startsAt),
        interviewType: parsed.data.type,
        location: parsed.data.location,
        notes: parsed.data.notes,
      })
      .returning();

    // Automatically advance application status to Interview Scheduled
    await db
      .update(applications)
      .set({ status: "Interview Scheduled", updatedAt: new Date() })
      .where(eq(applications.id, parsed.data.applicationId));

    await db.insert(applicationStatusHistory).values({
      applicationId: parsed.data.applicationId,
      status: "Interview Scheduled",
      changedBy: request.recruiter!.id,
      note: `Interview scheduled (${parsed.data.type})`,
    });

    response.status(201).json({ interview: created });
  } catch (error) {
    next(error);
  }
});

// 6. Recruiter Interviews
router.get("/recruiter/interviews", async (request, response, next) => {
  try {
    const companyJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.companyId, request.recruiter!.companyId));

    if (!companyJobs.length) {
      response.json({ interviews: [] });
      return;
    }

    const jobIds = companyJobs.map((j) => j.id);
    const rows = await db
      .select({
        id: interviews.id,
        applicationId: interviews.applicationId,
        startsAt: interviews.startsAt,
        type: interviews.interviewType,
        location: interviews.location,
        notes: interviews.notes,
        studentName: studentProfiles.fullName,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .innerJoin(applications, eq(interviews.applicationId, applications.id))
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(studentProfiles, eq(applications.studentId, studentProfiles.userId))
      .where(inArray(applications.jobId, jobIds))
      .orderBy(desc(interviews.startsAt));

    response.json({
      interviews: rows.map((r) => ({
        ...r,
        startsAt: r.startsAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// 7. Recruiter Analytics
router.get("/recruiter/analytics", async (request, response, next) => {
  try {
    const companyJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.companyId, request.recruiter!.companyId));

    if (!companyJobs.length) {
      response.json({
        totalApplicants: 0,
        selected: 0,
        shortlisted: 0,
        stages: [],
      });
      return;
    }

    const jobIds = companyJobs.map((j) => j.id);
    const appStats = await db
      .select({
        status: applications.status,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(inArray(applications.jobId, jobIds))
      .groupBy(applications.status);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const s of appStats) {
      counts[s.status] = s.count;
      total += s.count;
    }

    response.json({
      totalApplicants: total,
      selected: counts["Selected"] ?? 0,
      shortlisted: counts["Shortlisted"] ?? 0,
      interviewScheduled: counts["Interview Scheduled"] ?? 0,
      underReview: counts["Under Review"] ?? 0,
      stages: appStats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
