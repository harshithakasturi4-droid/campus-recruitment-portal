import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import pgPkg from "../../../lib/db/node_modules/pg/lib/index.js";
const { Client } = pgPkg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set!");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function runSqlFile(filePath) {
  console.log(`Running migration: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = sql.split("--> statement-breakpoint");
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    try {
      await client.query(trimmed);
    } catch (err) {
      if (err.code === "42710" || err.code === "42P07") {
        // type or relation already exists, ignore
      } else {
        console.warn(`Warning on statement: ${err.message}`);
      }
    }
  }
}

async function main() {
  await client.connect();
  console.log("Connected to Neon PostgreSQL!");

  // Step 1: Run migrations if needed
  const migrationsDir = path.resolve(process.cwd(), "lib/db/migrations");
  const migrationFiles = [
    "0000_icy_skreet.sql",
    "0001_concerned_lord_tyger.sql",
    "0002_handy_mantis.sql",
  ];

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDir, file);
    if (fs.existsSync(fullPath)) {
      await runSqlFile(fullPath);
    }
  }
  console.log("Migrations applied successfully!");

  // Step 2: Seed Admin User
  const adminEmail = "admin@placemate.edu";
  const existingAdmin = await client.query("SELECT id FROM users WHERE email = $1", [adminEmail]);
  let adminId;
  if (existingAdmin.rows.length === 0) {
    const adminPassHash = await bcrypt.hash("AdminPassword123!", 12);
    const res = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      [adminEmail, adminPassHash, "admin"]
    );
    adminId = res.rows[0].id;
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    adminId = existingAdmin.rows[0].id;
    console.log(`Admin user ${adminEmail} already exists.`);
  }

  // Step 3: Seed Companies & Recruiters
  const companiesData = [
    { name: "Northstar Systems", industry: "Enterprise software", location: "Bengaluru", recruiterName: "Leena Rao", email: "leena@northstarsystems.example" },
    { name: "Juniper Labs", industry: "Data & AI", location: "Hyderabad", recruiterName: "Arjun Nair", email: "arjun@juniperlabs.example" },
    { name: "Meridian Finance", industry: "Financial technology", location: "Mumbai", recruiterName: "Tara Shah", email: "tara@meridianfin.example" },
    { name: "Fieldnote", industry: "Consumer technology", location: "Remote", recruiterName: "Maya Sen", email: "maya@fieldnote.example" },
  ];

  const companyMap = new Map();
  const recruiterPassHash = await bcrypt.hash("Recruiter123!", 12);

  for (const c of companiesData) {
    let companyId;
    const existingComp = await client.query("SELECT id FROM companies WHERE name = $1", [c.name]);
    if (existingComp.rows.length === 0) {
      const compRes = await client.query(
        "INSERT INTO companies (name, industry, location) VALUES ($1, $2, $3) RETURNING id",
        [c.name, c.industry, c.location]
      );
      companyId = compRes.rows[0].id;
      console.log(`Created company: ${c.name}`);
    } else {
      companyId = existingComp.rows[0].id;
    }
    companyMap.set(c.name, companyId);

    // Create Recruiter User & Profile
    const existingRecruiter = await client.query("SELECT id FROM users WHERE email = $1", [c.email]);
    let recruiterUserId;
    if (existingRecruiter.rows.length === 0) {
      const uRes = await client.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [c.email, recruiterPassHash, "recruiter"]
      );
      recruiterUserId = uRes.rows[0].id;
      await client.query(
        "INSERT INTO recruiter_profiles (user_id, company_id, full_name) VALUES ($1, $2, $3)",
        [recruiterUserId, companyId, c.recruiterName]
      );
      console.log(`Created recruiter: ${c.email}`);
    }
  }

  // Step 4: Seed Students
  const studentsData = [
    { name: "Aarav Mehta", email: "aarav.mehta@northstar.edu", course: "B.Tech", department: "Computer Science", year: 2026, cgpa: "8.70", skills: ["TypeScript", "React", "Python", "SQL"], interests: ["Frontend", "Product engineering"] },
    { name: "Isha Raman", email: "isha.raman@northstar.edu", course: "B.Tech", department: "Information Technology", year: 2026, cgpa: "9.10", skills: ["Java", "Spring", "AWS", "SQL"], interests: ["Backend", "Cloud"] },
    { name: "Kabir Sethi", email: "kabir.sethi@northstar.edu", course: "B.Tech", department: "Computer Science", year: 2026, cgpa: "7.80", skills: ["Python", "Machine Learning", "Pandas"], interests: ["Data science"] },
    { name: "Mira Joseph", email: "mira.joseph@northstar.edu", course: "M.Tech", department: "Data Science", year: 2026, cgpa: "8.40", skills: ["Python", "SQL", "Tableau", "Statistics"], interests: ["Analytics", "Data science"] },
    { name: "Dev Patel", email: "dev.patel@northstar.edu", course: "B.Tech", department: "Electronics", year: 2026, cgpa: "7.20", skills: ["C++", "Embedded C", "Python"], interests: ["Systems"] },
    { name: "Naina Kapoor", email: "naina.kapoor@northstar.edu", course: "BBA", department: "Business Analytics", year: 2026, cgpa: "8.90", skills: ["Excel", "SQL", "Power BI", "Communication"], interests: ["Business analytics"] },
    { name: "Rohan Das", email: "rohan.das@northstar.edu", course: "B.Tech", department: "Computer Science", year: 2026, cgpa: "8.10", skills: ["React", "Node.js", "MongoDB"], interests: ["Full stack"] },
    { name: "Sana Qureshi", email: "sana.qureshi@northstar.edu", course: "M.Tech", department: "Information Technology", year: 2026, cgpa: "8.60", skills: ["Java", "Kubernetes", "AWS"], interests: ["Cloud", "DevOps"] },
  ];

  const studentMap = new Map();
  const studentPassHash = await bcrypt.hash("StudentPassword123!", 12);

  for (const s of studentsData) {
    const existingStudent = await client.query("SELECT id FROM users WHERE email = $1", [s.email]);
    let studentUserId;
    if (existingStudent.rows.length === 0) {
      const uRes = await client.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
        [s.email, studentPassHash, "student"]
      );
      studentUserId = uRes.rows[0].id;
      await client.query(
        `INSERT INTO student_profiles (user_id, full_name, course, department, graduation_year, cgpa, skills, interests)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [studentUserId, s.name, s.course, s.department, s.year, s.cgpa, s.skills, s.interests]
      );
      console.log(`Created student: ${s.email}`);
    } else {
      studentUserId = existingStudent.rows[0].id;
    }
    studentMap.set(s.email, studentUserId);
  }

  // Step 5: Seed Jobs
  const jobsData = [
    { title: "Associate Software Engineer", companyName: "Northstar Systems", location: "Bengaluru", category: "Engineering", packageLpa: "12.40", deadline: "2026-11-12", year: 2026, minCgpa: "7.50", courses: ["B.Tech", "M.Tech"], requiredSkills: ["React", "TypeScript", "SQL"], optionalSkills: ["Docker"], description: "Build reliable product experiences with a cross-functional engineering team. You will own features from design review through release.", status: "published" },
    { title: "Data Science Associate", companyName: "Juniper Labs", location: "Hyderabad", category: "Data", packageLpa: "14.20", deadline: "2026-11-14", year: 2026, minCgpa: "8.00", courses: ["B.Tech", "M.Tech"], requiredSkills: ["Python", "SQL", "Machine Learning"], optionalSkills: ["Pandas", "Scikit-Learn"], description: "Develop analytical models and turn product data into clear, measurable decisions alongside research and platform teams.", status: "published" },
    { title: "Graduate Backend Engineer", companyName: "Meridian Finance", location: "Mumbai", category: "Engineering", packageLpa: "11.80", deadline: "2026-11-17", year: 2026, minCgpa: "7.00", courses: ["B.Tech", "M.Tech"], requiredSkills: ["Java", "SQL", "AWS"], optionalSkills: ["Spring Boot"], description: "Contribute to secure, high-throughput financial services. The role includes mentorship, code review and production ownership.", status: "published" },
    { title: "Product Analyst", companyName: "Fieldnote", location: "Remote", category: "Analytics", packageLpa: "10.50", deadline: "2026-11-19", year: 2026, minCgpa: "7.50", courses: ["BBA", "B.Tech", "M.Tech"], requiredSkills: ["SQL", "Communication", "Power BI"], optionalSkills: ["Excel"], description: "Partner with product teams to frame customer questions, build dashboards and share recommendations.", status: "published" },
    { title: "Cloud Platform Trainee", companyName: "Northstar Systems", location: "Bengaluru", category: "Engineering", packageLpa: "9.60", deadline: "2026-11-25", year: 2026, minCgpa: "7.00", courses: ["B.Tech", "M.Tech"], requiredSkills: ["AWS", "Kubernetes", "Linux"], optionalSkills: ["Terraform"], description: "Support cloud platform reliability and automation with a team focused on dependable services.", status: "draft" },
  ];

  const jobMap = new Map();
  for (const j of jobsData) {
    const compId = companyMap.get(j.companyName);
    const existingJob = await client.query("SELECT id FROM jobs WHERE title = $1 AND company_id = $2", [j.title, compId]);
    let jobId;
    if (existingJob.rows.length === 0) {
      const res = await client.query(
        `INSERT INTO jobs (company_id, created_by, title, location, category, package_lpa, deadline, graduation_year, minimum_cgpa, eligible_courses, required_skills, optional_skills, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [compId, adminId, j.title, j.location, j.category, j.packageLpa, new Date(j.deadline), j.year, j.minCgpa, j.courses, j.requiredSkills, j.optionalSkills, j.description, j.status]
      );
      jobId = res.rows[0].id;
      console.log(`Created job: ${j.title}`);
    } else {
      jobId = existingJob.rows[0].id;
    }
    jobMap.set(j.title, jobId);
  }

  // Step 6: Seed Applications & History
  const appsData = [
    { studentEmail: "aarav.mehta@northstar.edu", jobTitle: "Associate Software Engineer", status: "Interview Scheduled", note: "Technical interview scheduled" },
    { studentEmail: "aarav.mehta@northstar.edu", jobTitle: "Data Science Associate", status: "Under Review", note: "Application is being reviewed" },
    { studentEmail: "aarav.mehta@northstar.edu", jobTitle: "Product Analyst", status: "Waiting for Result", note: "Final decision pending" },
    { studentEmail: "isha.raman@northstar.edu", jobTitle: "Graduate Backend Engineer", status: "Selected", note: "Offer confirmed" },
    { studentEmail: "kabir.sethi@northstar.edu", jobTitle: "Data Science Associate", status: "Interview Scheduled", note: "Technical interview scheduled" },
    { studentEmail: "mira.joseph@northstar.edu", jobTitle: "Data Science Associate", status: "Rejected", note: "Not selected for this role" },
    { studentEmail: "naina.kapoor@northstar.edu", jobTitle: "Product Analyst", status: "Selected", note: "Offer confirmed" },
    { studentEmail: "rohan.das@northstar.edu", jobTitle: "Associate Software Engineer", status: "Under Review", note: "Application is being reviewed" },
    { studentEmail: "sana.qureshi@northstar.edu", jobTitle: "Graduate Backend Engineer", status: "Applied", note: "Application submitted" },
    { studentEmail: "dev.patel@northstar.edu", jobTitle: "Associate Software Engineer", status: "Waiting for Result", note: "Final decision pending" },
  ];

  for (const a of appsData) {
    const sId = studentMap.get(a.studentEmail);
    const jId = jobMap.get(a.jobTitle);
    if (!sId || !jId) continue;

    const existingApp = await client.query("SELECT id FROM applications WHERE student_id = $1 AND job_id = $2", [sId, jId]);
    let appId;
    if (existingApp.rows.length === 0) {
      const appRes = await client.query(
        "INSERT INTO applications (student_id, job_id, status) VALUES ($1, $2, $3) RETURNING id",
        [sId, jId, a.status]
      );
      appId = appRes.rows[0].id;
      await client.query(
        "INSERT INTO application_status_history (application_id, status, changed_by, note) VALUES ($1, $2, $3, $4)",
        [appId, a.status, adminId, a.note]
      );
      console.log(`Created application: ${a.studentEmail} -> ${a.jobTitle}`);

      // If Interview Scheduled, create interview record
      if (a.status === "Interview Scheduled") {
        await client.query(
          `INSERT INTO interviews (application_id, scheduled_by, starts_at, interview_type, location, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [appId, adminId, new Date("2026-11-05T10:00:00Z"), "Technical Interview", "Google Meet / Video Room", "Prepare React and System Design"]
        );
      }
    }
  }

  console.log("Database initialized and fully seeded successfully!");
}

main()
  .catch((err) => {
    console.error("Initialization error:", err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
