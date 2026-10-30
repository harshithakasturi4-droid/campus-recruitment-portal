import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { companies, db, jobs } from "@workspace/db";
import { z } from "zod";

const router = Router();
const uuidSchema = z.string().uuid();

function jobDto(row: {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  category: string;
  packageLpa: string;
  deadline: Date;
  graduationYear: number;
  minimumCgpa: string;
  eligibleCourses: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  description: string;
  status: "published" | "draft" | "closed";
}) {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    company: row.companyName,
    location: row.location,
    category: row.category,
    package: Number(row.packageLpa),
    deadline: row.deadline.toISOString(),
    year: row.graduationYear,
    minCgpa: Number(row.minimumCgpa),
    courses: row.eligibleCourses,
    skills: row.requiredSkills,
    optionalSkills: row.optionalSkills,
    description: row.description,
    status: row.status === "published" ? "Open" : row.status === "draft" ? "Draft" : "Closed",
  };
}

const selection = {
  id: jobs.id,
  title: jobs.title,
  companyId: jobs.companyId,
  companyName: companies.name,
  location: jobs.location,
  category: jobs.category,
  packageLpa: jobs.packageLpa,
  deadline: jobs.deadline,
  graduationYear: jobs.graduationYear,
  minimumCgpa: jobs.minimumCgpa,
  eligibleCourses: jobs.eligibleCourses,
  requiredSkills: jobs.requiredSkills,
  optionalSkills: jobs.optionalSkills,
  description: jobs.description,
  status: jobs.status,
};

router.get("/jobs", async (_request, response, next) => {
  try {
    const rows = await db
      .select(selection)
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobs.status, "published"))
      .orderBy(jobs.deadline);
    response.json({ jobs: rows.map(jobDto) });
  } catch (error) {
    next(error);
  }
});

router.get("/jobs/:id", async (request, response, next) => {
  try {
    if (!uuidSchema.safeParse(request.params.id).success) {
      response.status(400).json({ error: "Job ID is invalid." });
      return;
    }
    const [row] = await db
      .select(selection)
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.id, request.params.id), eq(jobs.status, "published")))
      .limit(1);
    if (!row) {
      response.status(404).json({ error: "Job not found." });
      return;
    }
    response.json({ job: jobDto(row) });
  } catch (error) {
    next(error);
  }
});

export default router;
