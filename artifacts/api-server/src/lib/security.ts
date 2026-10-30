import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { authSessions, loginAttempts, users, studentProfiles, recruiterProfiles } from "@workspace/db/schema";

const SESSION_COOKIE = "placemate_session";
const CSRF_COOKIE = "placemate_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const secret = process.env.SESSION_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

export type AuthenticatedStudent = {
  id: string;
  email: string;
  role: "student";
  studentNumber: string;
  fullName: string;
  course: string;
  department: string;
  graduationYear: number;
  cgpa: string;
  skills: string[];
  interests: string[];
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "student" | "recruiter" | "admin";
};

export type AuthenticatedRecruiter = {
  id: string;
  email: string;
  role: "recruiter";
  companyId: string;
  fullName: string;
};

declare global {
  namespace Express {
    interface Request {
      student?: AuthenticatedStudent;
      recruiter?: AuthenticatedRecruiter;
      authenticatedUser?: AuthenticatedUser;
      sessionCsrfHash?: string;
    }
  }
}

export function hashValue(value: string): string {
  return createHmac("sha256", secret!).update(value).digest("hex");
}

export function databaseErrorCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    if (!("cause" in current)) return undefined;
    current = current.cause;
  }
  return undefined;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/api",
    maxAge,
  };
}

export function issueSessionCookies(response: Response, token: string, csrf: string) {
  response.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
  response.cookie(CSRF_COOKIE, csrf, {
    ...cookieOptions(SESSION_TTL_MS),
    httpOnly: false,
  });
}

export function clearSessionCookies(response: Response) {
  response.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
  response.clearCookie(CSRF_COOKIE, {
    ...cookieOptions(0),
    maxAge: undefined,
    httpOnly: false,
  });
}

export function createSessionCredentials() {
  return {
    token: randomBytes(32).toString("base64url"),
    csrf: randomBytes(32).toString("base64url"),
  };
}

export function sessionStorageValues(
  userId: string,
  credentials: ReturnType<typeof createSessionCredentials>,
) {
  return {
    tokenHash: hashValue(credentials.token),
    userId,
    csrfHash: hashValue(credentials.csrf),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

export async function loadStudentSession(request: Request) {
  const authenticatedUser = await loadAuthenticatedSession(request);
  if (!authenticatedUser || authenticatedUser.role !== "student") return null;

  const [profile] = await db
    .select({
      studentNumber: studentProfiles.studentNumber,
      fullName: studentProfiles.fullName,
      course: studentProfiles.course,
      department: studentProfiles.department,
      graduationYear: studentProfiles.graduationYear,
      cgpa: studentProfiles.cgpa,
      skills: studentProfiles.skills,
      interests: studentProfiles.interests,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, authenticatedUser.id))
    .limit(1);
  if (!profile) return null;
  return { ...authenticatedUser, ...profile } as AuthenticatedStudent;
}

export async function loadAuthenticatedSession(request: Request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token || token.length > 200) return null;

  const [record] = await db
    .select({
      csrfHash: authSessions.csrfHash,
      id: users.id,
      email: users.email,
      role: users.role,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, hashValue(token)), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  if (!record) return null;
  request.sessionCsrfHash = record.csrfHash;
  const authenticatedUser = { id: record.id, email: record.email, role: record.role };
  request.authenticatedUser = authenticatedUser;
  return authenticatedUser;
}

export async function requireAdmin(request: Request, response: Response, next: (error?: unknown) => void) {
  try {
    const user = await loadAuthenticatedSession(request);
    if (!user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    if (user.role !== "admin") {
      response.status(403).json({ error: "Administrator access required." });
      return;
    }
    request.authenticatedUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireStudent(request: Request, response: Response, next: (error?: unknown) => void) {
  try {
    const student = await loadStudentSession(request);
    if (!student) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    request.student = student;
    next();
  } catch (error) {
    next(error);
  }
}

export async function loadRecruiterSession(request: Request) {
  const authenticatedUser = await loadAuthenticatedSession(request);
  if (!authenticatedUser || authenticatedUser.role !== "recruiter") return null;

  const [profile] = await db
    .select({
      companyId: recruiterProfiles.companyId,
      fullName: recruiterProfiles.fullName,
    })
    .from(recruiterProfiles)
    .where(eq(recruiterProfiles.userId, authenticatedUser.id))
    .limit(1);
  if (!profile) return null;
  return { ...authenticatedUser, ...profile } as AuthenticatedRecruiter;
}

export async function requireRecruiter(request: Request, response: Response, next: (error?: unknown) => void) {
  try {
    const recruiter = await loadRecruiterSession(request);
    if (!recruiter) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    request.recruiter = recruiter;
    next();
  } catch (error) {
    next(error);
  }
}

export function verifyCsrf(request: Request, response: Response, next: (error?: unknown) => void) {
  if (!verifyRequestOrigin(request)) {
    response.status(403).json({ error: "Request origin is not allowed." });
    return;
  }

  const cookie = request.cookies?.[CSRF_COOKIE];
  const header = request.get("x-csrf-token");
  const storedHash = request.sessionCsrfHash;
  if (!cookie || !header || cookie !== header || !storedHash) {
    response.status(403).json({ error: "CSRF validation failed." });
    return;
  }

  const expected = Buffer.from(storedHash);
  const actual = Buffer.from(hashValue(header));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    response.status(403).json({ error: "CSRF validation failed." });
    return;
  }
  next();
}

export function verifyRequestOrigin(request: Request) {
  const origin = request.get("origin");
  if (!origin) return true;
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
  if (origin === allowedOrigin) return true;
  try {
    const parsed = new URL(origin);
    if (
      parsed.hostname.endsWith(".vercel.app") ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    ) {
      return true;
    }
  } catch {}
  return false;
}

export async function enforceLoginRateLimit(key: string) {
  const keyHash = hashValue(key);
  const windowStartedAt = new Date(Date.now() - 15 * 60 * 1000);
  const [attempt] = await db
    .insert(loginAttempts)
    .values({ keyHash, windowStartedAt: new Date(), attemptCount: 1 })
    .onConflictDoUpdate({
      target: loginAttempts.keyHash,
      set: {
        windowStartedAt: sql`CASE WHEN ${loginAttempts.windowStartedAt} < ${windowStartedAt} THEN now() ELSE ${loginAttempts.windowStartedAt} END`,
        attemptCount: sql`CASE WHEN ${loginAttempts.windowStartedAt} < ${windowStartedAt} THEN 1 ELSE ${loginAttempts.attemptCount} + 1 END`,
      },
    })
    .returning({ attemptCount: loginAttempts.attemptCount });
  return attempt.attemptCount <= 10;
}

export function normalizeEmail(email: string) {
  return email.trim().normalize("NFC").toLowerCase();
}

export function sessionCookieToken(request: Request) {
  return request.cookies?.[SESSION_COOKIE] as string | undefined;
}
