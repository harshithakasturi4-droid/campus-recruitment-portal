import { Router } from "express";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { applicationStatusHistory, applications, companies, db, jobs, studentProfiles } from "@workspace/db";
import { z } from "zod";
import { databaseErrorCode, requireStudent, verifyCsrf } from "../lib/security";

const router = Router();
const applicationSchema = z.object({ jobId: z.string().uuid() }).strict();

router.post("/applications", requireStudent, verifyCsrf, async (request, response, next) => {
  try {
    const parsed = applicationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "A valid job ID is required." });
      return;
    }

    const result = await db.transaction(async (transaction) => {
      const [job] = await transaction
        .select({
          id: jobs.id,
          status: jobs.status,
          deadline: jobs.deadline,
          graduationYear: jobs.graduationYear,
          minimumCgpa: jobs.minimumCgpa,
          eligibleCourses: jobs.eligibleCourses,
          requiredSkills: jobs.requiredSkills,
        })
        .from(jobs)
        .where(eq(jobs.id, parsed.data.jobId))
        .limit(1);
      if (!job || job.status !== "published" || job.deadline <= new Date()) {
        return { error: "This job is not accepting applications.", status: 409 as const };
      }

      const [profile] = await transaction
        .select({
          course: studentProfiles.course,
          graduationYear: studentProfiles.graduationYear,
          cgpa: studentProfiles.cgpa,
          skills: studentProfiles.skills,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, request.student!.id))
        .limit(1);
      if (!profile) {
        return { error: "A student profile is required before applying.", status: 422 as const };
      }
      if (profile.graduationYear !== job.graduationYear) {
        return { error: `This role is for the class of ${job.graduationYear}.`, status: 422 as const };
      }
      if (Number(profile.cgpa) < Number(job.minimumCgpa)) {
        return { error: `This role requires a minimum CGPA of ${job.minimumCgpa}.`, status: 422 as const };
      }
      if (job.eligibleCourses.length > 0 && !job.eligibleCourses.includes(profile.course)) {
        return { error: "Your course is not included in this role's eligibility criteria.", status: 422 as const };
      }
      const missingSkill = job.requiredSkills.find(
        (skill) => !profile.skills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase()),
      );
      if (missingSkill) {
        return { error: `Add the required skill "${missingSkill}" to your profile before applying.`, status: 422 as const };
      }

      const [application] = await transaction
        .insert(applications)
        .values({ studentId: request.student!.id, jobId: job.id })
        .returning();
      await transaction.insert(applicationStatusHistory).values({
        applicationId: application.id,
        previousStatus: null,
        status: "Applied",
        changedBy: request.student!.id,
        note: "Application submitted",
      });
      return { application };
    });

    if (typeof result.status === "number") {
      response.status(result.status).json({ error: result.error });
      return;
    }
    response.status(201).json({ application: result.application });
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      response.status(409).json({ error: "You have already applied to this job." });
      return;
    }
    next(error);
  }
});

router.get("/applications/me", requireStudent, async (request, response, next) => {
  try {
    const rows = await db
      .select({
        id: applications.id,
        studentId: applications.studentId,
        jobId: applications.jobId,
        date: applications.appliedAt,
        status: applications.status,
        jobTitle: jobs.title,
        company: companies.name,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.studentId, request.student!.id))
      .orderBy(desc(applications.appliedAt));
    const historyRows = rows.length
      ? await db
          .select({
            applicationId: applicationStatusHistory.applicationId,
            status: applicationStatusHistory.status,
            date: applicationStatusHistory.changedAt,
            note: applicationStatusHistory.note,
          })
          .from(applicationStatusHistory)
          .where(inArray(applicationStatusHistory.applicationId, rows.map((row) => row.id)))
          .orderBy(asc(applicationStatusHistory.changedAt))
      : [];
    response.json({
      applications: rows.map((row) => ({
        ...row,
        date: row.date.toISOString(),
        history: historyRows
          .filter((history) => history.applicationId === row.id)
          .map(({ status, date, note }) => ({ status, date: date.toISOString(), note })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
