import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, studentProfiles } from "@workspace/db";
import { requireStudent, verifyCsrf } from "../lib/security";
import { z } from "zod";

const router = Router();
const profilePatch = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    course: z.string().trim().min(1).max(100).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    cgpa: z.number().min(0).max(10).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    interests: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

router.get("/students/me", requireStudent, (request, response) => {
  response.json({ student: request.student });
});

router.patch("/students/me", requireStudent, verifyCsrf, async (request, response, next) => {
  try {
    const parsed = profilePatch.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Profile update is invalid." });
      return;
    }

    const { cgpa, ...profileFields } = parsed.data;
    const changes = {
      ...profileFields,
      ...(cgpa === undefined ? {} : { cgpa: cgpa.toFixed(2) }),
      updatedAt: new Date(),
    };
    const [updated] = await db
      .update(studentProfiles)
      .set(changes)
      .where(eq(studentProfiles.userId, request.student!.id))
      .returning({
        id: studentProfiles.userId,
        studentNumber: studentProfiles.studentNumber,
        fullName: studentProfiles.fullName,
        course: studentProfiles.course,
        department: studentProfiles.department,
        graduationYear: studentProfiles.graduationYear,
        cgpa: studentProfiles.cgpa,
        skills: studentProfiles.skills,
        interests: studentProfiles.interests,
      });
    response.json({
      student: {
        ...updated,
        email: request.student!.email,
        role: "student",
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
