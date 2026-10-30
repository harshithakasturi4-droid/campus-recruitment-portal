import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  authSessions,
  db,
  insertStudentProfile,
  studentProfiles,
  recruiterProfiles,
  users,
} from "@workspace/db";
import {
  clearSessionCookies,
  createSessionCredentials,
  databaseErrorCode,
  enforceLoginRateLimit,
  hashValue,
  issueSessionCookies,
  loadAuthenticatedSession,
  loadStudentSession,
  normalizeEmail,
  sessionCookieToken,
  sessionStorageValues,
  verifyCsrf,
  verifyRequestOrigin,
} from "../lib/security";

const router = Router();
const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Password must not exceed 72 UTF-8 bytes.",
  }),
  course: z.string().trim().min(1).max(100),
  department: z.string().trim().min(1).max(120),
  graduationYear: z.number().int().min(2000).max(2099),
});
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Email or password is invalid.",
  }),
});

function csrfCookie(request: { cookies?: Record<string, string> }) {
  return request.cookies?.placemate_csrf || null;
}

router.post("/auth/register", async (request, response, next) => {
  try {
    if (!verifyRequestOrigin(request)) {
      response.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Please provide valid registration details." });
      return;
    }

    const email = normalizeEmail(parsed.data.email);
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const session = createSessionCredentials();
    const account = await db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(users)
        .values({ email, passwordHash, role: "student" })
        .returning({ id: users.id, email: users.email });
      const [profile] = await insertStudentProfile(transaction, {
        userId: created.id,
        fullName: parsed.data.fullName,
        course: parsed.data.course,
        department: parsed.data.department,
        graduationYear: parsed.data.graduationYear,
        cgpa: "0",
        skills: [],
        interests: [],
      });
      await transaction.insert(authSessions).values(sessionStorageValues(created.id, session));
      return { user: created, profile };
    });

    issueSessionCookies(response, session.token, session.csrf);
    response.status(201).json({
      user: {
        id: account.user.id,
        email: account.user.email,
        role: "student",
        fullName: parsed.data.fullName,
      },
      student: {
        id: account.profile.userId,
        email: account.user.email,
        role: "student",
        studentNumber: account.profile.studentNumber,
        fullName: account.profile.fullName,
        course: account.profile.course,
        department: account.profile.department,
        graduationYear: account.profile.graduationYear,
        cgpa: account.profile.cgpa,
        skills: account.profile.skills,
        interests: account.profile.interests,
      },
      csrfToken: session.csrf,
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    next(error);
  }
});

router.post("/auth/login", async (request, response, next) => {
  try {
    if (!verifyRequestOrigin(request)) {
      response.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Email or password is invalid." });
      return;
    }
    const email = normalizeEmail(parsed.data.email);
    const allowed = await enforceLoginRateLimit(`${request.ip}:${email}`);
    if (!allowed) {
      response.status(429).json({ error: "Too many sign-in attempts. Try again later." });
      return;
    }

    const [userRecord] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const valid = userRecord ? await bcrypt.compare(parsed.data.password, userRecord.passwordHash) : false;
    if (!userRecord || !valid || !["student", "recruiter"].includes(userRecord.role)) {
      response.status(401).json({ error: "Email or password is invalid." });
      return;
    }

    let fullName = userRecord.email;
    if (userRecord.role === "student") {
      const [profile] = await db
        .select({ fullName: studentProfiles.fullName })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userRecord.id))
        .limit(1);
      if (profile) fullName = profile.fullName;
    } else if (userRecord.role === "recruiter") {
      const [profile] = await db
        .select({ fullName: recruiterProfiles.fullName })
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, userRecord.id))
        .limit(1);
      if (profile) fullName = profile.fullName;
    }

    const previousToken = sessionCookieToken(request);
    const session = createSessionCredentials();
    await db.transaction(async (transaction) => {
      if (previousToken) {
        await transaction.delete(authSessions).where(eq(authSessions.tokenHash, hashValue(previousToken)));
      }
      await transaction.insert(authSessions).values(sessionStorageValues(userRecord.id, session));
    });
    issueSessionCookies(response, session.token, session.csrf);
    response.json({
      user: {
        id: userRecord.id,
        email: userRecord.email,
        role: userRecord.role,
        fullName,
      },
      csrfToken: session.csrf,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/admin/login", async (request, response, next) => {
  try {
    if (!verifyRequestOrigin(request)) {
      response.status(403).json({ error: "Request origin is not allowed." });
      return;
    }
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Email or password is invalid." });
      return;
    }
    const email = normalizeEmail(parsed.data.email);
    const allowed = await enforceLoginRateLimit(`${request.ip}:${email}`);
    if (!allowed) {
      response.status(429).json({ error: "Too many sign-in attempts. Try again later." });
      return;
    }

    const [record] = await db
      .select({ id: users.id, email: users.email, role: users.role, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const valid = record ? await bcrypt.compare(parsed.data.password, record.passwordHash) : false;
    if (!record || record.role !== "admin" || !valid) {
      response.status(401).json({ error: "Email or password is invalid." });
      return;
    }

    const previousToken = sessionCookieToken(request);
    const session = createSessionCredentials();
    await db.transaction(async (transaction) => {
      if (previousToken) {
        await transaction.delete(authSessions).where(eq(authSessions.tokenHash, hashValue(previousToken)));
      }
      await transaction.insert(authSessions).values(sessionStorageValues(record.id, session));
    });
    issueSessionCookies(response, session.token, session.csrf);
    response.json({
      user: { id: record.id, email: record.email, role: "admin", fullName: "Placement administrator" },
      csrfToken: session.csrf,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", async (request, response, next) => {
  try {
    const user = await loadAuthenticatedSession(request);
    if (!user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    if (user.role === "student") {
      const student = await loadStudentSession(request);
      if (!student) {
        response.status(401).json({ error: "Authentication required." });
        return;
      }
      response.json({
        user: { id: student.id, email: student.email, role: student.role, fullName: student.fullName },
        student,
        csrfToken: csrfCookie(request),
      });
      return;
    }
    let fullName = user.role === "admin" ? "Placement administrator" : user.email;
    if (user.role === "recruiter") {
      const [profile] = await db
        .select({ fullName: recruiterProfiles.fullName })
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, user.id))
        .limit(1);
      if (profile) fullName = profile.fullName;
    }
    response.json({
      user: { id: user.id, email: user.email, role: user.role, fullName },
      csrfToken: csrfCookie(request),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (request, response, next) => {
  try {
    const user = await loadAuthenticatedSession(request);
    if (user) {
      verifyCsrf(request, response, () => undefined);
      if (response.headersSent) return;
      const token = sessionCookieToken(request);
      if (token) await db.delete(authSessions).where(eq(authSessions.tokenHash, hashValue(token)));
    }
    clearSessionCookies(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
