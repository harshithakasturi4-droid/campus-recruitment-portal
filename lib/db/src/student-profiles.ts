import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { studentProfiles, type NewStudentProfile } from "./schema";

export async function insertStudentProfile(
  database: NodePgDatabase<typeof schema>,
  profile: NewStudentProfile,
) {
  return database
    .insert(studentProfiles)
    .values({ ...profile, studentNumber: sql`DEFAULT` })
    .returning();
}
