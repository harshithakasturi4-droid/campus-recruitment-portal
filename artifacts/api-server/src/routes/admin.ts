import { Router } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  applicationStatusHistory,
  applications,
  companies,
  db,
  jobs,
  recruiterProfiles,
  studentProfiles,
  users,
} from "@workspace/db";
import { requireAdmin } from "../lib/security";

const router = Router();
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};
const placementStatus = z.enum(["Selected", "Shortlisted", "In Progress", "Not Applied", "Rejected"]);
const applicationStatus = z.enum([
  "Applied",
  "Under Review",
  "Shortlisted",
  "Interview Scheduled",
  "Waiting for Result",
  "Selected",
  "Rejected",
  "Withdrawn",
]);
const jobStatus = z.enum(["draft", "published", "closed"]);

const studentPlacementStatus = sql<string>`CASE
  WHEN EXISTS (SELECT 1 FROM applications a WHERE a.student_id = ${studentProfiles.userId} AND a.status = 'Selected') THEN 'Selected'
  WHEN EXISTS (SELECT 1 FROM applications a WHERE a.student_id = ${studentProfiles.userId} AND a.status = 'Shortlisted') THEN 'Shortlisted'
  WHEN EXISTS (SELECT 1 FROM applications a WHERE a.student_id = ${studentProfiles.userId} AND a.status = 'Rejected') THEN 'Rejected'
  WHEN EXISTS (SELECT 1 FROM applications a WHERE a.student_id = ${studentProfiles.userId}) THEN 'In Progress'
  ELSE 'Not Applied'
END`;
const applicationTotal = sql<number>`(
  SELECT count(*)::int FROM applications a WHERE a.student_id = ${studentProfiles.userId}
)`;

const studentQuery = z.object({
  ...pagination,
  search: z.string().trim().max(120).optional(),
  year: z.coerce.number().int().min(2000).max(2099).optional(),
  course: z.string().trim().max(100).optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  maxCgpa: z.coerce.number().min(0).max(10).optional(),
  status: placementStatus.optional(),
});

router.use(requireAdmin);

router.get("/admin/stats", async (_request, response, next) => {
  try {
    const [studentCount, recruiterCount, companyCount, jobCounts, applicationCounts, selectedStudents] =
      await Promise.all([
        db.select({ total: count() }).from(studentProfiles),
        db.select({ total: count() }).from(recruiterProfiles),
        db.select({ total: count() }).from(companies),
        db.select({ total: count() }).from(jobs).where(eq(jobs.status, "published")),
        db.select({
          total: count(),
          selected: sql<number>`count(*) FILTER (WHERE ${applications.status} = 'Selected')::int`,
          rejected: sql<number>`count(*) FILTER (WHERE ${applications.status} = 'Rejected')::int`,
          shortlisted: sql<number>`count(*) FILTER (WHERE ${applications.status} = 'Shortlisted')::int`,
        }).from(applications),
        db.select({ total: sql<number>`count(DISTINCT ${applications.studentId})::int` })
          .from(applications)
          .where(eq(applications.status, "Selected")),
      ]);
    const totalStudents = studentCount[0]?.total ?? 0;
    const selected = selectedStudents[0]?.total ?? 0;
    response.json({
      stats: {
        students: totalStudents,
        recruiters: recruiterCount[0]?.total ?? 0,
        companies: companyCount[0]?.total ?? 0,
        publishedJobs: jobCounts[0]?.total ?? 0,
        applications: applicationCounts[0]?.total ?? 0,
        selected: applicationCounts[0]?.selected ?? 0,
        rejected: applicationCounts[0]?.rejected ?? 0,
        shortlisted: applicationCounts[0]?.shortlisted ?? 0,
        placedStudents: selected,
        placementPercentage: totalStudents === 0 ? 0 : Number(((selected / totalStudents) * 100).toFixed(1)),
        placementDefinition: "Distinct students with at least one Selected application divided by all registered student profiles.",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/students", async (request, response, next) => {
  try {
    const parsed = studentQuery.safeParse(request.query);
    if (!parsed.success || (parsed.data.minCgpa !== undefined && parsed.data.maxCgpa !== undefined && parsed.data.minCgpa > parsed.data.maxCgpa)) {
      response.status(400).json({ error: "Student filters are invalid." });
      return;
    }
    const { page, pageSize, search, year, course, minCgpa, maxCgpa, status } = parsed.data;
    const conditions = [];
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(
        ilike(studentProfiles.fullName, pattern),
        ilike(users.email, pattern),
        ilike(studentProfiles.studentNumber, pattern),
      )!);
    }
    if (year !== undefined) conditions.push(eq(studentProfiles.graduationYear, year));
    if (course) conditions.push(ilike(studentProfiles.course, `%${course}%`));
    if (minCgpa !== undefined) conditions.push(gte(studentProfiles.cgpa, minCgpa.toFixed(2)));
    if (maxCgpa !== undefined) conditions.push(lte(studentProfiles.cgpa, maxCgpa.toFixed(2)));
    if (status) conditions.push(sql`${studentPlacementStatus} = ${status}`);
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRows, years, courses] = await Promise.all([
      db.select({
        id: studentProfiles.userId,
        studentNumber: studentProfiles.studentNumber,
        fullName: studentProfiles.fullName,
        email: users.email,
        course: studentProfiles.course,
        department: studentProfiles.department,
        graduationYear: studentProfiles.graduationYear,
        cgpa: studentProfiles.cgpa,
        skills: studentProfiles.skills,
        applicationCount: applicationTotal,
        placementStatus: studentPlacementStatus,
      }).from(studentProfiles)
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(where)
        .orderBy(asc(studentProfiles.fullName), asc(studentProfiles.studentNumber))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(studentProfiles)
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .where(where),
      db.selectDistinct({ year: studentProfiles.graduationYear }).from(studentProfiles).orderBy(desc(studentProfiles.graduationYear)),
      db.selectDistinct({ course: studentProfiles.course }).from(studentProfiles).orderBy(asc(studentProfiles.course)),
    ]);
    const total = totalRows[0]?.total ?? 0;
    response.json({
      students: rows,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      filters: { years: years.map((row) => row.year), courses: courses.map((row) => row.course) },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/students/:id", async (request, response, next) => {
  try {
    const id = z.string().uuid().safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Student ID is invalid." });
      return;
    }
    const [student] = await db.select({
      id: studentProfiles.userId,
      studentNumber: studentProfiles.studentNumber,
      fullName: studentProfiles.fullName,
      email: users.email,
      role: users.role,
      course: studentProfiles.course,
      department: studentProfiles.department,
      graduationYear: studentProfiles.graduationYear,
      cgpa: studentProfiles.cgpa,
      skills: studentProfiles.skills,
      interests: studentProfiles.interests,
      createdAt: studentProfiles.createdAt,
      applicationCount: applicationTotal,
      placementStatus: studentPlacementStatus,
    }).from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(eq(studentProfiles.userId, id.data))
      .limit(1);
    if (!student) {
      response.status(404).json({ error: "Student not found." });
      return;
    }
    const rows = await db.select({
      id: applications.id,
      jobId: applications.jobId,
      status: applications.status,
      appliedAt: applications.appliedAt,
      updatedAt: applications.updatedAt,
      title: jobs.title,
      company: companies.name,
    }).from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(eq(applications.studentId, id.data))
      .orderBy(desc(applications.appliedAt));
    const history = rows.length ? await db.select({
      applicationId: applicationStatusHistory.applicationId,
      status: applicationStatusHistory.status,
      changedAt: applicationStatusHistory.changedAt,
      note: applicationStatusHistory.note,
    }).from(applicationStatusHistory)
      .where(inArray(applicationStatusHistory.applicationId, rows.map((row) => row.id)))
      .orderBy(asc(applicationStatusHistory.changedAt)) : [];
    response.json({
      student,
      applications: rows.map((row) => ({
        ...row,
        appliedAt: row.appliedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        history: history.filter((event) => event.applicationId === row.id)
          .map(({ status, changedAt, note }) => ({ status, changedAt: changedAt.toISOString(), note })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/recruiters", async (_request, response, next) => {
  try {
    const rows = await db.select({
      id: users.id,
      email: users.email,
      fullName: recruiterProfiles.fullName,
      companyId: companies.id,
      company: companies.name,
      industry: companies.industry,
      location: companies.location,
      createdAt: recruiterProfiles.createdAt,
      jobCount: sql<number>`(SELECT count(*)::int FROM jobs j WHERE j.created_by = ${users.id})`,
      jobTitles: sql<string[]>`ARRAY(SELECT j.title FROM jobs j WHERE j.created_by = ${users.id} ORDER BY j.title)`,
    }).from(users)
      .innerJoin(recruiterProfiles, eq(recruiterProfiles.userId, users.id))
      .innerJoin(companies, eq(companies.id, recruiterProfiles.companyId))
      .where(eq(users.role, "recruiter"))
      .orderBy(asc(companies.name), asc(recruiterProfiles.fullName));
    response.json({ recruiters: rows.map(({ createdAt, ...row }) => ({ ...row, accountStatus: "Registered", createdAt: createdAt.toISOString() })) });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/companies", async (_request, response, next) => {
  try {
    const rows = await db.select({
      id: companies.id,
      name: companies.name,
      industry: companies.industry,
      location: companies.location,
      recruiterCount: sql<number>`(SELECT count(*)::int FROM recruiter_profiles rp WHERE rp.company_id = ${companies.id})`,
      jobCount: sql<number>`(SELECT count(*)::int FROM jobs j WHERE j.company_id = ${companies.id})`,
    }).from(companies).orderBy(asc(companies.name));
    response.json({ companies: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/jobs", async (request, response, next) => {
  try {
    const parsed = z.object({
      ...pagination,
      companyId: z.string().uuid().optional(),
      status: jobStatus.optional(),
    }).safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "Job filters are invalid." });
      return;
    }
    const conditions = [];
    if (parsed.data.companyId) conditions.push(eq(jobs.companyId, parsed.data.companyId));
    if (parsed.data.status) conditions.push(eq(jobs.status, parsed.data.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRows, companyRows] = await Promise.all([
      db.select({
        id: jobs.id,
        title: jobs.title,
        companyId: companies.id,
        company: companies.name,
        status: jobs.status,
        deadline: jobs.deadline,
        graduationYear: jobs.graduationYear,
        packageLpa: jobs.packageLpa,
        applicationCount: sql<number>`(SELECT count(*)::int FROM applications a WHERE a.job_id = ${jobs.id})`,
      }).from(jobs).innerJoin(companies, eq(companies.id, jobs.companyId))
        .where(where).orderBy(desc(jobs.createdAt)).limit(parsed.data.pageSize).offset((parsed.data.page - 1) * parsed.data.pageSize),
      db.select({ total: count() }).from(jobs).where(where),
      db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name)),
    ]);
    const total = totalRows[0]?.total ?? 0;
    response.json({
      jobs: rows.map((row) => ({ ...row, packageLpa: Number(row.packageLpa), deadline: row.deadline.toISOString() })),
      companies: companyRows,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total,
      pages: Math.ceil(total / parsed.data.pageSize),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/applications", async (request, response, next) => {
  try {
    const parsed = z.object({
      ...pagination,
      status: applicationStatus.optional(),
      jobId: z.string().uuid().optional(),
    }).safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "Application filters are invalid." });
      return;
    }
    const conditions = [];
    if (parsed.data.status) conditions.push(eq(applications.status, parsed.data.status));
    if (parsed.data.jobId) conditions.push(eq(applications.jobId, parsed.data.jobId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRows, statusCounts, jobOptions] = await Promise.all([
      db.select({
        id: applications.id,
        status: applications.status,
        appliedAt: applications.appliedAt,
        studentId: studentProfiles.userId,
        studentNumber: studentProfiles.studentNumber,
        studentName: studentProfiles.fullName,
        studentEmail: users.email,
        jobId: jobs.id,
        jobTitle: jobs.title,
        company: companies.name,
      }).from(applications)
        .innerJoin(studentProfiles, eq(studentProfiles.userId, applications.studentId))
        .innerJoin(users, eq(users.id, studentProfiles.userId))
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .innerJoin(companies, eq(companies.id, jobs.companyId))
        .where(where).orderBy(desc(applications.appliedAt))
        .limit(parsed.data.pageSize).offset((parsed.data.page - 1) * parsed.data.pageSize),
      db.select({ total: count() }).from(applications).where(where),
      db.select({ status: applications.status, total: count() }).from(applications).groupBy(applications.status),
      db.select({ id: jobs.id, title: jobs.title, company: companies.name })
        .from(jobs)
        .innerJoin(companies, eq(companies.id, jobs.companyId))
        .orderBy(asc(companies.name), asc(jobs.title)),
    ]);
    const total = totalRows[0]?.total ?? 0;
    response.json({
      applications: rows.map((row) => ({ ...row, appliedAt: row.appliedAt.toISOString() })),
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total,
      pages: Math.ceil(total / parsed.data.pageSize),
      counts: {
        selected: statusCounts.find((row) => row.status === "Selected")?.total ?? 0,
        rejected: statusCounts.find((row) => row.status === "Rejected")?.total ?? 0,
        shortlisted: statusCounts.find((row) => row.status === "Shortlisted")?.total ?? 0,
        pending: statusCounts.filter((row) => ["Applied", "Under Review", "Interview Scheduled", "Waiting for Result"].includes(row.status))
          .reduce((sum, row) => sum + row.total, 0),
      },
      jobs: jobOptions,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
