export type Role = 'student' | 'recruiter' | 'admin';
export type AppStatus = 'Applied' | 'Under Review' | 'Shortlisted' | 'Interview Scheduled' | 'Waiting for Result' | 'Selected' | 'Rejected' | 'Withdrawn';
export type Student = { id: string; name: string; email: string; course: string; department: string; year: number; cgpa: number; skills: string[]; interests: string[]; completion: number; placed: boolean; };
export type Company = { id: string; name: string; industry: string; location: string; recruiter: string; email: string; };
export type Job = { id: string; title: string; companyId: string; location: string; category: string; package: number; deadline: string; year: number; minCgpa: number; courses: string[]; skills: string[]; description: string; status: 'Open' | 'Draft' | 'Closed'; };
export type History = { status: AppStatus; date: string; note: string; };
export type Application = { id: string; studentId: string; jobId: string; date: string; status: AppStatus; history: History[]; };
export type Interview = { id: string; applicationId: string; date: string; time: string; type: string; location: string; };
export type DemoState = { students: Student[]; companies: Company[]; jobs: Job[]; applications: Application[]; interviews: Interview[]; savedJobs: string[]; notifications: { id: string; title: string; body: string; date: string; read: boolean }[]; };

export const statuses: AppStatus[] = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Waiting for Result', 'Selected', 'Rejected', 'Withdrawn'];
const seed: DemoState = {
  students: [
    { id: 'PM-24018', name: 'Aarav Mehta', email: 'aarav.mehta@northstar.edu', course: 'B.Tech', department: 'Computer Science', year: 2026, cgpa: 8.7, skills: ['TypeScript', 'React', 'Python', 'SQL'], interests: ['Frontend', 'Product engineering'], completion: 92, placed: false },
    { id: 'PM-24022', name: 'Isha Raman', email: 'isha.raman@northstar.edu', course: 'B.Tech', department: 'Information Technology', year: 2026, cgpa: 9.1, skills: ['Java', 'Spring', 'AWS', 'SQL'], interests: ['Backend', 'Cloud'], completion: 96, placed: true },
    { id: 'PM-24031', name: 'Kabir Sethi', email: 'kabir.sethi@northstar.edu', course: 'B.Tech', department: 'Computer Science', year: 2026, cgpa: 7.8, skills: ['Python', 'Machine Learning', 'Pandas'], interests: ['Data science'], completion: 78, placed: false },
    { id: 'PM-24043', name: 'Mira Joseph', email: 'mira.joseph@northstar.edu', course: 'M.Tech', department: 'Data Science', year: 2026, cgpa: 8.4, skills: ['Python', 'SQL', 'Tableau', 'Statistics'], interests: ['Analytics', 'Data science'], completion: 88, placed: false },
    { id: 'PM-24057', name: 'Dev Patel', email: 'dev.patel@northstar.edu', course: 'B.Tech', department: 'Electronics', year: 2026, cgpa: 7.2, skills: ['C++', 'Embedded C', 'Python'], interests: ['Systems'], completion: 70, placed: false },
    { id: 'PM-24063', name: 'Naina Kapoor', email: 'naina.kapoor@northstar.edu', course: 'BBA', department: 'Business Analytics', year: 2026, cgpa: 8.9, skills: ['Excel', 'SQL', 'Power BI', 'Communication'], interests: ['Business analytics'], completion: 89, placed: true },
    { id: 'PM-24071', name: 'Rohan Das', email: 'rohan.das@northstar.edu', course: 'B.Tech', department: 'Computer Science', year: 2026, cgpa: 8.1, skills: ['React', 'Node.js', 'MongoDB'], interests: ['Full stack'], completion: 83, placed: false },
    { id: 'PM-24089', name: 'Sana Qureshi', email: 'sana.qureshi@northstar.edu', course: 'M.Tech', department: 'Information Technology', year: 2026, cgpa: 8.6, skills: ['Java', 'Kubernetes', 'AWS'], interests: ['Cloud', 'DevOps'], completion: 91, placed: false },
  ],
  companies: [
    { id: 'co-1', name: 'Northstar Systems', industry: 'Enterprise software', location: 'Bengaluru', recruiter: 'Leena Rao', email: 'leena@northstarsystems.example' },
    { id: 'co-2', name: 'Juniper Labs', industry: 'Data & AI', location: 'Hyderabad', recruiter: 'Arjun Nair', email: 'arjun@juniperlabs.example' },
    { id: 'co-3', name: 'Meridian Finance', industry: 'Financial technology', location: 'Mumbai', recruiter: 'Tara Shah', email: 'tara@meridianfin.example' },
    { id: 'co-4', name: 'Fieldnote', industry: 'Consumer technology', location: 'Remote', recruiter: 'Maya Sen', email: 'maya@fieldnote.example' },
  ],
  jobs: [
    { id: 'job-101', title: 'Associate Software Engineer', companyId: 'co-1', location: 'Bengaluru', category: 'Engineering', package: 12.4, deadline: '2026-11-12', year: 2026, minCgpa: 7.5, courses: ['B.Tech', 'M.Tech'], skills: ['React', 'TypeScript', 'SQL'], description: 'Build reliable product experiences with a cross-functional engineering team. You will own features from design review through release.', status: 'Open' },
    { id: 'job-102', title: 'Data Science Associate', companyId: 'co-2', location: 'Hyderabad', category: 'Data', package: 14.2, deadline: '2026-11-14', year: 2026, minCgpa: 8, courses: ['B.Tech', 'M.Tech'], skills: ['Python', 'SQL', 'Machine Learning'], description: 'Develop analytical models and turn product data into clear, measurable decisions alongside research and platform teams.', status: 'Open' },
    { id: 'job-103', title: 'Graduate Backend Engineer', companyId: 'co-3', location: 'Mumbai', category: 'Engineering', package: 11.8, deadline: '2026-11-17', year: 2026, minCgpa: 7, courses: ['B.Tech', 'M.Tech'], skills: ['Java', 'SQL', 'AWS'], description: 'Contribute to secure, high-throughput financial services. The role includes mentorship, code review and production ownership.', status: 'Open' },
    { id: 'job-104', title: 'Product Analyst', companyId: 'co-4', location: 'Remote', category: 'Analytics', package: 10.5, deadline: '2026-11-19', year: 2026, minCgpa: 7.5, courses: ['BBA', 'B.Tech', 'M.Tech'], skills: ['SQL', 'Communication', 'Power BI'], description: 'Partner with product teams to frame customer questions, build dashboards and share recommendations.', status: 'Open' },
    { id: 'job-105', title: 'Cloud Platform Trainee', companyId: 'co-1', location: 'Bengaluru', category: 'Engineering', package: 9.6, deadline: '2026-11-25', year: 2026, minCgpa: 7, courses: ['B.Tech', 'M.Tech'], skills: ['AWS', 'Kubernetes', 'Linux'], description: 'Support cloud platform reliability and automation with a team focused on dependable services.', status: 'Draft' },
  ],
  applications: [
    { id: 'app-501', studentId: 'PM-24018', jobId: 'job-101', date: '2026-10-18', status: 'Interview Scheduled', history: [{ status: 'Applied', date: '2026-10-18', note: 'Application submitted' }, { status: 'Under Review', date: '2026-10-20', note: 'Recruiter review started' }, { status: 'Shortlisted', date: '2026-10-24', note: 'Advanced to technical round' }, { status: 'Interview Scheduled', date: '2026-10-26', note: 'Technical interview scheduled' }] },
    { id: 'app-502', studentId: 'PM-24018', jobId: 'job-102', date: '2026-10-22', status: 'Under Review', history: [{ status: 'Applied', date: '2026-10-22', note: 'Application submitted' }, { status: 'Under Review', date: '2026-10-25', note: 'Application is being reviewed' }] },
    { id: 'app-503', studentId: 'PM-24018', jobId: 'job-104', date: '2026-10-16', status: 'Waiting for Result', history: [{ status: 'Applied', date: '2026-10-16', note: 'Application submitted' }, { status: 'Shortlisted', date: '2026-10-19', note: 'Shortlisted after screening' }, { status: 'Interview Scheduled', date: '2026-10-22', note: 'Interview completed' }, { status: 'Waiting for Result', date: '2026-10-24', note: 'Final decision pending' }] },
    { id: 'app-504', studentId: 'PM-24022', jobId: 'job-103', date: '2026-10-13', status: 'Selected', history: [{ status: 'Applied', date: '2026-10-13', note: 'Application submitted' }, { status: 'Shortlisted', date: '2026-10-17', note: 'Advanced to interviews' }, { status: 'Selected', date: '2026-10-25', note: 'Offer confirmed' }] },
    { id: 'app-505', studentId: 'PM-24031', jobId: 'job-102', date: '2026-10-21', status: 'Interview Scheduled', history: [{ status: 'Applied', date: '2026-10-21', note: 'Application submitted' }, { status: 'Under Review', date: '2026-10-24', note: 'Recruiter review started' }, { status: 'Shortlisted', date: '2026-10-27', note: 'Advanced to technical round' }, { status: 'Interview Scheduled', date: '2026-10-28', note: 'Technical interview scheduled' }] },
    { id: 'app-506', studentId: 'PM-24043', jobId: 'job-102', date: '2026-10-19', status: 'Rejected', history: [{ status: 'Applied', date: '2026-10-19', note: 'Application submitted' }, { status: 'Rejected', date: '2026-10-23', note: 'Not selected for this role' }] },
    { id: 'app-507', studentId: 'PM-24063', jobId: 'job-104', date: '2026-10-12', status: 'Selected', history: [{ status: 'Applied', date: '2026-10-12', note: 'Application submitted' }, { status: 'Shortlisted', date: '2026-10-16', note: 'Shortlisted after screening' }, { status: 'Selected', date: '2026-10-26', note: 'Offer confirmed' }] },
    { id: 'app-508', studentId: 'PM-24071', jobId: 'job-101', date: '2026-10-23', status: 'Under Review', history: [{ status: 'Applied', date: '2026-10-23', note: 'Application submitted' }, { status: 'Under Review', date: '2026-10-27', note: 'Application is being reviewed' }] },
    { id: 'app-509', studentId: 'PM-24089', jobId: 'job-103', date: '2026-10-25', status: 'Applied', history: [{ status: 'Applied', date: '2026-10-25', note: 'Application submitted' }] },
    { id: 'app-510', studentId: 'PM-24057', jobId: 'job-101', date: '2026-10-20', status: 'Waiting for Result', history: [{ status: 'Applied', date: '2026-10-20', note: 'Application submitted' }, { status: 'Shortlisted', date: '2026-10-24', note: 'Advanced to technical round' }, { status: 'Waiting for Result', date: '2026-10-28', note: 'Final decision pending' }] },
  ],
  interviews: [
    { id: 'int-701', applicationId: 'app-501', date: '2026-11-03', time: '10:30', type: 'Technical interview', location: 'Northstar video room' },
    { id: 'int-702', applicationId: 'app-505', date: '2026-11-05', time: '14:00', type: 'Technical interview', location: 'Juniper Labs, Hyderabad' },
    { id: 'int-703', applicationId: 'app-503', date: '2026-10-22', time: '11:00', type: 'Final conversation', location: 'Fieldnote video room' },
  ],
  savedJobs: ['job-103'],
  notifications: [
    { id: 'note-1', title: 'Interview scheduled', body: 'Northstar Systems · Associate Software Engineer · 3 November at 10:30', date: '2026-10-28', read: false },
    { id: 'note-2', title: 'Application update', body: 'Your application to Juniper Labs is under review.', date: '2026-10-27', read: false },
    { id: 'note-3', title: 'Placement office update', body: 'The November placement drive calendar is now available.', date: '2026-10-26', read: true },
  ],
};

const KEY = 'placemate-demo-v1';
export function loadDemo(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      if (parsed.students && parsed.jobs && parsed.applications && parsed.companies) return { ...seed, ...parsed };
    }
  } catch { /* use isolated fixtures if stored demo state cannot be read */ }
  return structuredClone(seed);
}
export function saveDemo(state: DemoState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* session remains usable if storage is unavailable */ }
}
export function resetDemo(): DemoState {
  try { localStorage.removeItem(KEY); } catch { /* no-op */ }
  return structuredClone(seed);
}
export const initialDemo = (): DemoState => structuredClone(seed);
