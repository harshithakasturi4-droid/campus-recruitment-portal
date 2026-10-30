import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Building2, ShieldAlert, Users } from "lucide-react";
import { apiRequest, setCsrfToken } from "./api";

type AdminUser = { id: string; email: string; role: "admin"; fullName: string };
type Stats = {
  students: number; recruiters: number; companies: number; publishedJobs: number;
  applications: number; selected: number; rejected: number; shortlisted: number;
  placedStudents: number; placementPercentage: number; placementDefinition: string;
};
type DirectoryStudent = {
  id: string; studentNumber: string; fullName: string; email: string; course: string;
  department: string; graduationYear: number; cgpa: string; skills: string[];
  applicationCount: number; placementStatus: string;
};
type StudentDetail = DirectoryStudent & { interests: string[]; createdAt: string };
type AdminApplication = {
  id: string; status: string; appliedAt: string; studentId: string; studentNumber: string;
  studentName: string; studentEmail: string; jobId: string; jobTitle: string; company: string;
  title?: string;
  history?: { status: string; changedAt: string; note: string | null }[];
};
type AdminJob = {
  id: string; title: string; companyId: string; company: string; status: string;
  deadline: string; graduationYear: number; packageLpa: number; applicationCount: number;
};
type Recruiter = {
  id: string; email: string; fullName: string; company: string; industry: string;
  location: string; jobCount: number; jobTitles: string[]; accountStatus: string;
};
type AdminCompany = { id: string; name: string; industry: string; location: string; recruiterCount: number; jobCount: number };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export function AdminLoginPage({ onLogin }: { onLogin: (user: AdminUser, csrf: string) => void }) {
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ user: AdminUser; csrfToken: string }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: String(data.get("email")), password: String(data.get("password")) }),
      });
      setCsrfToken(result.csrfToken);
      onLogin(result.user, result.csrfToken);
      localStorage.setItem("placemate-mode", "api");
      setLocation("/admin");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-layout"><Link href="/" className="brand"><span className="brand-mark"><Users size={20} /></span><span>placemate<span className="brand-period">.</span></span></Link><section className="auth-card">
    <Link href="/login" className="back-link">← Student sign in</Link><p className="eyebrow">ADMINISTRATOR ACCESS</p>
    <h1>Placement office sign in</h1><p className="auth-intro">Use an administrator account provisioned by your system operator. Public admin registration is disabled.</p>
    <form className="auth-form" onSubmit={submit}>
      <label className="field-label" htmlFor="admin-email">Email address</label><input className="input" id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} />
      <label className="field-label" htmlFor="admin-password">Password</label><input className="input" id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={72} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? "Verifying…" : "Sign in securely"} <ArrowRight size={16} /></button>
    </form>
  </section><div className="auth-foot">PlaceMate · Administrator workspace</div></div>;
}

export function AdminWorkspacePage({ kind, studentId }: { kind: string; studentId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [detail, setDetail] = useState<{ student: StudentDetail; applications: AdminApplication[] } | null>(null);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [jobOptions, setJobOptions] = useState<{ id: string; title: string; company: string }[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<{ selected: number; rejected: number; shortlisted: number; pending: number } | null>(null);
  const [filters, setFilters] = useState<{ search: string; year: string; course: string; cgpa: string; maxCgpa: string; status: string; companyId: string; jobId: string }>({
    search: "", year: "", course: "", cgpa: "", maxCgpa: "", status: "", companyId: "", jobId: "",
  });
  const [options, setOptions] = useState<{ years: number[]; courses: string[]; companies: { id: string; name: string }[] }>({ years: [], courses: [], companies: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const update = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  useEffect(() => {
    setPage(1);
    setFilters({ search: "", year: "", course: "", cgpa: "", maxCgpa: "", status: "", companyId: "", jobId: "" });
  }, [kind]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("pageSize", "25");
      if (kind === "students") {
        if (filters.search) query.set("search", filters.search);
        if (filters.year) query.set("year", filters.year);
        if (filters.course) query.set("course", filters.course);
        if (filters.cgpa) query.set("minCgpa", filters.cgpa);
        if (filters.maxCgpa) query.set("maxCgpa", filters.maxCgpa);
        if (filters.status) query.set("status", filters.status);
      }
      if (kind === "drives") {
        if (filters.companyId) query.set("companyId", filters.companyId);
        if (filters.status) query.set("status", filters.status);
      }
      if (kind === "applications") {
        if (filters.jobId) query.set("jobId", filters.jobId);
        if (filters.status) query.set("status", filters.status);
      }
      const suffix = query.size ? `?${query}` : "";
      try {
        if (kind === "admin-home" || kind === "analytics") {
          const result = await apiRequest<{ stats: Stats }>("/admin/stats");
          if (active) setStats(result.stats);
        } else if (kind === "students") {
          const result = await apiRequest<{ students: DirectoryStudent[]; filters: { years: number[]; courses: string[] }; pages: number }>("/admin/students" + suffix);
          if (active) {
            setStudents(result.students);
            setPageCount(result.pages);
            setOptions((old) => ({ ...old, years: result.filters.years, courses: result.filters.courses }));
          }
        } else if (kind === "student-detail") {
          const result = await apiRequest<{ student: StudentDetail; applications: AdminApplication[] }>(`/admin/students/${encodeURIComponent(studentId)}`);
          if (active) setDetail(result);
        } else if (kind === "companies") {
          const [recruiterResult, companyResult] = await Promise.all([
            apiRequest<{ recruiters: Recruiter[] }>("/admin/recruiters"),
            apiRequest<{ companies: AdminCompany[] }>("/admin/companies"),
          ]);
          if (active) {
            setRecruiters(recruiterResult.recruiters);
            setCompanies(companyResult.companies);
          }
        } else if (kind === "drives") {
          const result = await apiRequest<{ jobs: AdminJob[]; companies: { id: string; name: string }[]; pages: number }>("/admin/jobs" + suffix);
          if (active) {
            setJobs(result.jobs);
            setPageCount(result.pages);
            setOptions((old) => ({ ...old, companies: result.companies }));
          }
        } else if (kind === "applications") {
          const result = await apiRequest<{ applications: AdminApplication[]; counts: { selected: number; rejected: number; shortlisted: number; pending: number }; pages: number; jobs: { id: string; title: string; company: string }[] }>("/admin/applications" + suffix);
          if (active) {
            setApplications(result.applications);
            setApplicationCounts(result.counts);
            setPageCount(result.pages);
            setJobOptions(result.jobs);
          }
        } else {
          throw new Error("This administrator view is not available in the live API yet.");
        }
      } catch (requestError) {
        if (active) setError(messageOf(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [kind, studentId, filters, page]);

  const pagination = (items: number) => pageCount > 1 && <div className="pagination"><span>{items} on this page · Page {page} of {pageCount}</span><div><button type="button" className="pagination-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button><button type="button" className="pagination-button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>›</button></div></div>;

  const heading = kind === "admin-home" ? "Placement overview"
    : kind === "students" ? "Student directory"
    : kind === "student-detail" ? "Student record"
    : kind === "companies" ? "Companies & recruiters"
    : kind === "classification" ? "Student classification"
    : kind === "drives" ? "Jobs and placement drives"
    : kind === "applications" ? "Application monitoring"
    : "Placement analytics";
  const title = <div className="page-heading"><div><p className="eyebrow">LIVE DATABASE · ADMIN</p><h1>{heading}</h1><p>Read-only management view from the PlaceMate API.</p></div></div>;
  if (loading) return <section className="page-enter">{title}<div className="standalone-state" role="status">Loading administrator records…</div></section>;
  if (error) return <section className="page-enter">{title}<div className="callout" role="alert"><ShieldAlert size={17} />{error}</div><button className="button button-secondary" onClick={() => setFilters((current) => ({ ...current }))}>Retry</button></section>;

  if ((kind === "admin-home" || kind === "analytics") && stats) {
    const cards = [
      ["Registered students", stats.students], ["Recruiters", stats.recruiters], ["Companies", stats.companies],
      ["Published jobs", stats.publishedJobs], ["Applications", stats.applications], ["Selected applications", stats.selected],
      ["Shortlisted applications", stats.shortlisted], ["Rejected applications", stats.rejected],
    ];
    return <section className="page-enter">{title}<div className="metric-grid">{cards.map(([label, value]) => <article className="metric-card" key={label}><span className="metric-label">{label}</span><b>{value}</b><small>Current database total</small></article>)}</div>
      <article className="panel"><div className="panel-heading"><div><h2>Overall placement</h2><p>{stats.placedStudents} of {stats.students} registered students have a selected application.</p></div><b>{stats.placementPercentage}%</b></div><p className="muted-copy">{stats.placementDefinition}</p><Link className="subtle-link" href="/admin/students">Open student directory <ArrowRight size={15} /></Link></article></section>;
  }
  if (kind === "students") return <section className="page-enter">{title}<div className="panel">
    <div className="admin-filters"><input className="input" aria-label="Search students" placeholder="Search name, email or student number" value={filters.search} onChange={(e) => update("search", e.target.value)} />
      <select className="input" aria-label="Graduation year" value={filters.year} onChange={(e) => update("year", e.target.value)}><option value="">All graduation years</option>{options.years.map((year) => <option key={year}>{year}</option>)}</select>
      <select className="input" aria-label="Course" value={filters.course} onChange={(e) => update("course", e.target.value)}><option value="">All courses</option>{options.courses.map((course) => <option key={course}>{course}</option>)}</select>
      <input className="input" aria-label="Minimum CGPA" type="number" min="0" max="10" step="0.1" placeholder="Minimum CGPA" value={filters.cgpa} onChange={(e) => update("cgpa", e.target.value)} />
      <input className="input" aria-label="Maximum CGPA" type="number" min="0" max="10" step="0.1" placeholder="Maximum CGPA" value={filters.maxCgpa} onChange={(e) => update("maxCgpa", e.target.value)} />
      <select className="input" aria-label="Placement status" value={filters.status} onChange={(e) => update("status", e.target.value)}><option value="">All placement statuses</option>{["Selected", "Shortlisted", "In Progress", "Not Applied", "Rejected"].map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    {students.length === 0 ? <p className="empty-state">No students match these filters.</p> : <div className="table-scroll"><table className="data-table"><thead><tr>{["Student", "Email", "Course / Department", "Year", "CGPA", "Skills", "Applications", "Placement", ""].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><b>{student.studentNumber}</b><br />{student.fullName}</td><td>{student.email}</td><td>{student.course}<br /><small>{student.department}</small></td><td>{student.graduationYear}</td><td>{student.cgpa}</td><td>{student.skills.join(", ") || "—"}</td><td>{student.applicationCount}</td><td>{student.placementStatus}</td><td><Link className="subtle-link" href={`/admin/students/${student.id}`}>View</Link></td></tr>)}</tbody></table></div>}
  </div>{pagination(students.length)}</section>;
  if (kind === "student-detail" && detail) return <section className="page-enter">{title}<Link href="/admin/students" className="back-link">← Student directory</Link><article className="panel">
    <h2>{detail.student.fullName}</h2><p><b>{detail.student.studentNumber}</b> · {detail.student.email}</p><div className="admin-detail-grid">{[
      ["Course", detail.student.course], ["Department", detail.student.department], ["Graduation year", detail.student.graduationYear],
      ["CGPA", detail.student.cgpa], ["Placement status", detail.student.placementStatus], ["Applications", detail.student.applicationCount],
      ["Skills", detail.student.skills.join(", ") || "—"], ["Interests", detail.student.interests.join(", ") || "—"],
    ].map(([label, value]) => <p key={label}><small>{label}</small><br /><b>{value}</b></p>)}</div>
  </article><article className="panel"><h2>Application history</h2>{detail.applications.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Role</th><th>Company</th><th>Applied</th><th>Status history</th></tr></thead><tbody>{detail.applications.map((application) => <tr key={application.id}><td>{application.title}</td><td>{application.company}</td><td>{new Date(application.appliedAt).toLocaleDateString()}</td><td>{application.history?.map((event) => <div key={`${event.changedAt}-${event.status}`}><b>{event.status}</b> · {new Date(event.changedAt).toLocaleDateString()} {event.note && `· ${event.note}`}</div>)}{!application.history?.length && application.status}</td></tr>)}</tbody></table></div> : <p className="empty-state">No applications recorded.</p>}</article></section>;
  if (kind === "companies") return <section className="page-enter">{title}<article className="panel"><h2>Companies</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Recruiters</th><th>Jobs</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><td>{company.name}</td><td>{company.industry}</td><td>{company.location}</td><td>{company.recruiterCount}</td><td>{company.jobCount}</td></tr>)}</tbody></table>{companies.length === 0 && <p className="empty-state">No companies found.</p>}</div></article><article className="panel"><h2>Recruiters</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Recruiter</th><th>Email</th><th>Company</th><th>Industry</th><th>Location</th><th>Account status</th><th>Associated jobs</th></tr></thead><tbody>{recruiters.map((item) => <tr key={item.id}><td>{item.fullName}</td><td>{item.email}</td><td>{item.company}</td><td>{item.industry}</td><td>{item.location}</td><td>{item.accountStatus}</td><td>{item.jobTitles.length ? `${item.jobCount}: ${item.jobTitles.join(", ")}` : "No jobs"}</td></tr>)}</tbody></table>{recruiters.length === 0 && <p className="empty-state">No recruiter profiles found.</p>}</div><p className="muted-copy">Account status is shown as Registered because the current schema has no active/suspended status field.</p></article></section>;
  if (kind === "drives") return <section className="page-enter">{title}<div className="admin-filters"><select className="input" aria-label="Company filter" value={filters.companyId} onChange={(e) => update("companyId", e.target.value)}><option value="">All companies</option>{options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><select className="input" aria-label="Job status filter" value={filters.status} onChange={(e) => update("status", e.target.value)}><option value="">All job statuses</option>{["published", "draft", "closed"].map((status) => <option key={status}>{status}</option>)}</select></div><div className="panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>Job</th><th>Company</th><th>Status</th><th>Deadline</th><th>Graduation year</th><th>Package (LPA)</th><th>Applications</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td>{job.title}</td><td>{job.company}</td><td>{job.status}</td><td>{new Date(job.deadline).toLocaleDateString()}</td><td>{job.graduationYear}</td><td>{job.packageLpa}</td><td>{job.applicationCount}</td></tr>)}</tbody></table>{jobs.length === 0 && <p className="empty-state">No jobs match these filters.</p>}</div></div>{pagination(jobs.length)}</section>;
  if (kind === "applications") return <section className="page-enter">{title}<div className="metric-grid">{[["Selected", applicationCounts?.selected], ["Rejected", applicationCounts?.rejected], ["Shortlisted", applicationCounts?.shortlisted], ["Pending review", applicationCounts?.pending]].map(([label, value]) => <article className="metric-card" key={label}><span className="metric-label">{label}</span><b>{value ?? 0}</b></article>)}</div><div className="admin-filters"><select className="input" aria-label="Application status filter" value={filters.status} onChange={(e) => update("status", e.target.value)}><option value="">All application statuses</option>{["Applied", "Under Review", "Shortlisted", "Interview Scheduled", "Waiting for Result", "Selected", "Rejected", "Withdrawn"].map((status) => <option key={status}>{status}</option>)}</select><select className="input" aria-label="Filter by job" value={filters.jobId} onChange={(e) => update("jobId", e.target.value)}><option value="">All jobs</option>{jobOptions.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}</select></div><div className="panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>Student</th><th>Email</th><th>Job</th><th>Company</th><th>Applied</th><th>Status</th></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td><Link href={`/admin/students/${application.studentId}`}>{application.studentNumber} · {application.studentName}</Link></td><td>{application.studentEmail}</td><td>{application.jobTitle}</td><td>{application.company}</td><td>{new Date(application.appliedAt).toLocaleDateString()}</td><td>{application.status}</td></tr>)}</tbody></table>{applications.length === 0 && <p className="empty-state">No applications match these filters.</p>}</div></div>{pagination(applications.length)}</section>;
  return <section className="page-enter">{title}<div className="standalone-state"><Building2 size={26} /><p>This view has no live API workflow yet.</p></div></section>;
}
