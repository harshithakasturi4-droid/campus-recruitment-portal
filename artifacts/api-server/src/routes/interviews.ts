import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { applications, companies, db, interviews, jobs } from "@workspace/db";
import { requireStudent } from "../lib/security";

const router = Router();

router.get("/interviews/me", requireStudent, async (request, response, next) => {
  try {
    const rows = await db
      .select({
        id: interviews.id,
        applicationId: interviews.applicationId,
        startsAt: interviews.startsAt,
        type: interviews.interviewType,
        location: interviews.location,
        notes: interviews.notes,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(interviews)
      .innerJoin(applications, eq(interviews.applicationId, applications.id))
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.studentId, request.student!.id))
      .orderBy(desc(interviews.startsAt));

    response.json({
      interviews: rows.map((r) => ({
        id: r.id,
        applicationId: r.applicationId,
        jobTitle: r.jobTitle,
        company: r.companyName,
        date: r.startsAt.toISOString().split("T")[0],
        time: r.startsAt.toISOString().split("T")[1]?.slice(0, 5) || "10:00",
        type: r.type,
        location: r.location,
        notes: r.notes,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
