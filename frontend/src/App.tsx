import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter, Link, useParams } from 'wouter';
import { Activity, ArrowDown, ArrowLeft, ArrowRight, Bell, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, Check, CircleHelp, ClipboardList, FileText, GraduationCap, LayoutDashboard, ListFilter, LogOut, Menu, Plus, Search, Settings, ShieldAlert, Sparkles, Users, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { type AppStatus, type Application, type Company, type DemoState, type Job, type Role, type Student, statuses, loadDemo, resetDemo, saveDemo } from './demo';
import NotFound from '@/pages/not-found';
import { apiRequest, setCsrfToken, type ApiApplication, type ApiJob, type ApiStudent } from './api';
import { AdminLoginPage, AdminWorkspacePage } from './AdminPages';

const queryClient = new QueryClient();
type AuthUser = { id: string; email: string; role: Role; fullName: string };
type ContextValue = { role: Role; setRole: (role: Role) => void; demo: DemoState; updateDemo: (next: DemoState) => void; mode: 'demo' | 'api'; setMode: (mode: 'demo' | 'api') => void; auth: AuthUser | null; student: ApiStudent | null; authLoading: boolean; authRestoreError: string; setSession: (user: AuthUser | null, profile?: ApiStudent | null, csrf?: string | null) => void; };
const PMContext = createContext<ContextValue | null>(null);
function usePM() { const ctx = useContext(PMContext); if (!ctx) throw new Error('PlaceMate context is unavailable'); return ctx; }

const roleTitles: Record<Role, string> = { student: 'Student', recruiter: 'Recruiter', admin: 'Placement office' };
const nav: Record<Role, { label: string; path: string; icon: typeof LayoutDashboard; group: string }[]> = {
  student: [
    { label: 'Overview', path: '/student', icon: LayoutDashboard, group: 'Workspace' },
    { label: 'Browse jobs', path: '/student/jobs', icon: BriefcaseBusiness, group: 'Workspace' },
    { label: 'Applications', path: '/student/applications', icon: ClipboardList, group: 'Workspace' },
    { label: 'Interviews', path: '/student/interviews', icon: CalendarDays, group: 'Workspace' },
    { label: 'My profile', path: '/student/profile', icon: Users, group: 'Career tools' },
    { label: 'Resume review', path: '/student/resume-review', icon: FileText, group: 'Career tools' },
    { label: 'Career guide', path: '/student/career-guide', icon: Sparkles, group: 'Career tools' },
    { label: 'Notifications', path: '/student/notifications', icon: Bell, group: 'Career tools' },
  ],
  recruiter: [
    { label: 'Overview', path: '/recruiter', icon: LayoutDashboard, group: 'Hiring' },
    { label: 'Manage jobs', path: '/recruiter/jobs', icon: BriefcaseBusiness, group: 'Hiring' },
    { label: 'Applicants', path: '/recruiter/applicants', icon: Users, group: 'Hiring' },
    { label: 'Interviews', path: '/recruiter/interviews', icon: CalendarDays, group: 'Hiring' },
    { label: 'Hiring analytics', path: '/recruiter/analytics', icon: ChartNoAxesCombined, group: 'Insights' },
    { label: 'Company profile', path: '/recruiter/company', icon: Building2, group: 'Insights' },
  ],
  admin: [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard, group: 'Placement office' },
    { label: 'Students', path: '/admin/students', icon: Users, group: 'Placement office' },
    { label: 'Classification', path: '/admin/classification', icon: ListFilter, group: 'Placement office' },
    { label: 'Companies & recruiters', path: '/admin/companies', icon: Building2, group: 'Operations' },
    { label: 'Drives & jobs', path: '/admin/drives', icon: BriefcaseBusiness, group: 'Operations' },
    { label: 'Applications', path: '/admin/applications', icon: ClipboardList, group: 'Operations' },
    { label: 'Interviews', path: '/admin/interviews', icon: CalendarDays, group: 'Operations' },
    { label: 'Placement analytics', path: '/admin/analytics', icon: ChartNoAxesCombined, group: 'Insights' },
    { label: 'Settings', path: '/admin/settings', icon: Settings, group: 'Insights' },
  ],
};
const routeMeta: { path: string; role?: Role; title: string; kind: string }[] = [
  { path: '/', title: 'Welcome to PlaceMate', kind: 'landing' }, { path: '/login', title: 'Sign in', kind: 'login' }, { path: '/register', title: 'Create your account', kind: 'register' }, { path: '/admin/login', title: 'Administrator sign in', kind: 'admin-login' }, { path: '/unauthorized', title: 'Access restricted', kind: 'unauthorized' },
  { path: '/student', role: 'student', title: 'Your placement journey', kind: 'student-home' }, { path: '/student/profile', role: 'student', title: 'My profile', kind: 'profile' }, { path: '/student/jobs', role: 'student', title: 'Find your next role', kind: 'jobs' }, { path: '/student/jobs/:id', role: 'student', title: 'Role details', kind: 'job-detail' },
  { path: '/student/applications', role: 'student', title: 'Application tracker', kind: 'applications' }, { path: '/student/applications/:id', role: 'student', title: 'Application details', kind: 'application-detail' }, { path: '/student/interviews', role: 'student', title: 'Interview schedule', kind: 'interviews' }, { path: '/student/resume-review', role: 'student', title: 'Resume review', kind: 'resume' }, { path: '/student/career-guide', role: 'student', title: 'Career guide', kind: 'career-guide' }, { path: '/student/notifications', role: 'student', title: 'Notifications', kind: 'notifications' },
  { path: '/recruiter', role: 'recruiter', title: 'Hiring overview', kind: 'recruiter-home' }, { path: '/recruiter/company', role: 'recruiter', title: 'Company profile', kind: 'company' }, { path: '/recruiter/jobs', role: 'recruiter', title: 'Manage jobs', kind: 'recruiter-jobs' }, { path: '/recruiter/jobs/new', role: 'recruiter', title: 'Create a job', kind: 'job-form' }, { path: '/recruiter/jobs/:id/edit', role: 'recruiter', title: 'Edit job', kind: 'job-form' }, { path: '/recruiter/jobs/:id/applicants', role: 'recruiter', title: 'Job applicants', kind: 'recruiter-applicants' }, { path: '/recruiter/applicants', role: 'recruiter', title: 'Candidates', kind: 'recruiter-applicants' }, { path: '/recruiter/applicants/:id', role: 'recruiter', title: 'Candidate profile', kind: 'applicant-detail' }, { path: '/recruiter/interviews', role: 'recruiter', title: 'Interview schedule', kind: 'interviews' }, { path: '/recruiter/analytics', role: 'recruiter', title: 'Hiring analytics', kind: 'analytics' },
  { path: '/admin', role: 'admin', title: 'Placement overview', kind: 'admin-home' }, { path: '/admin/students', role: 'admin', title: 'Student directory', kind: 'students' }, { path: '/admin/students/:id', role: 'admin', title: 'Student record', kind: 'student-detail' }, { path: '/admin/classification', role: 'admin', title: 'Student classification', kind: 'classification' }, { path: '/admin/companies', role: 'admin', title: 'Companies & recruiters', kind: 'companies' }, { path: '/admin/drives', role: 'admin', title: 'Drives & jobs', kind: 'drives' }, { path: '/admin/applications', role: 'admin', title: 'Application monitoring', kind: 'applications' }, { path: '/admin/interviews', role: 'admin', title: 'Interview management', kind: 'interviews' }, { path: '/admin/analytics', role: 'admin', title: 'Placement analytics', kind: 'analytics' }, { path: '/admin/settings', role: 'admin', title: 'Portal settings', kind: 'settings' },
];

function App() {
  const [role, setRoleState] = useState<Role>(() => localStorage.getItem('placemate-mode') === 'api' ? 'student' : (localStorage.getItem('placemate-role') as Role) || 'student');
  const [demo, setDemo] = useState<DemoState>(() => loadDemo());
  const [mode, setModeState] = useState<'demo' | 'api'>(() => localStorage.getItem('placemate-mode') === 'api' ? 'api' : 'demo');
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [student, setStudent] = useState<ApiStudent | null>(null);
  const [authLoading, setAuthLoading] = useState(() => localStorage.getItem('placemate-mode') === 'api');
  const [authRestoreError, setAuthRestoreError] = useState('');
  const updateDemo = (next: DemoState) => { setDemo(next); saveDemo(next); };
  const setRole = (value: Role) => { setRoleState(value); localStorage.setItem('placemate-role', value); };
  const setSession = (user: AuthUser | null, profile: ApiStudent | null = null, csrf?: string | null) => {
    setAuth(user);
    setStudent(profile);
    if (user) {
      setRoleState(user.role);
      localStorage.setItem('placemate-role', user.role);
    } else {
      setRoleState('student');
    }
    if (user) setAuthRestoreError('');
    if (csrf !== undefined) setCsrfToken(csrf);
  };
  const setMode = (value: 'demo' | 'api') => {
    setModeState(value);
    localStorage.setItem('placemate-mode', value);
    if (value === 'api') {
      setAuthLoading(true);
      setAuthRestoreError('');
    } else {
      setAuthLoading(false);
    }
  };
  useEffect(() => {
    if (mode !== 'api') return;
    let active = true;
    apiRequest<{ user: AuthUser; student?: ApiStudent; csrfToken: string | null }>('/auth/me')
      .then(({ user, student: profile, csrfToken }) => {
        if (active) setSession(user, profile, csrfToken);
      })
      .catch((error: unknown) => {
        if (active) {
          setSession(null, null, null);
          const message = error instanceof Error ? error.message : '';
          setAuthRestoreError(/401|authentication required/i.test(message) ? '' : 'Could not restore a live session. Check that the API is available, then sign in.');
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, [mode]);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><PMContext.Provider value={{ role, setRole, demo, updateDemo, mode, setMode, auth, student, authLoading, authRestoreError, setSession }}><Router /></PMContext.Provider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

function Router() {
  const [location] = useLocation();
  return <Boundary resetKey={location}><AppShell><Switch>
    {routeMeta.map(route => <Route key={route.path} path={route.path} component={() => <Screen route={route} />} />)}
    <Route component={NotFound} />
  </Switch></AppShell></Boundary>;
}
function Boundary({ resetKey, children }: { resetKey: string; children: ReactNode }) { return <ErrorBoundary resetKey={resetKey}>{children}</ErrorBoundary>; }

function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, mode, setMode, auth, setSession } = usePM();
  const [loc, setLoc] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const publicPage = ['/', '/login', '/register', '/admin/login', '/unauthorized'].includes(loc);
  const active = nav[role].find(item => loc === item.path || (item.path !== '/student' && item.path !== '/recruiter' && item.path !== '/admin' && loc.startsWith(item.path + '/')));
  const logout = async () => {
    setLogoutError('');
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      setSession(null, null, null);
      setLoc('/login');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'The server could not invalidate your session.');
    }
  };
  if (publicPage) return <div className="public-root">{children}</div>;
  return <div className="app-frame">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><GraduationCap size={21} /></span><span>placemate<span className="brand-period">.</span></span></Link>
      <div className="demo-note"><span className="live-dot" /> {mode === 'demo' ? 'DEMO WORKSPACE' : 'LIVE ACCOUNT'}</div>
      {mode === 'demo' && <>
        <div className="role-label">WORKING AS</div>
        <label className="role-select-label" htmlFor="role-switch">Role preview</label>
        <select id="role-switch" className="role-select" value={role} onChange={e => { setRole(e.target.value as Role); setLoc(nav[e.target.value as Role][0].path); setMobileOpen(false); }} data-testid="select-role">
          <option value="student">Student · Aarav Mehta</option><option value="recruiter">Recruiter · Leena Rao</option><option value="admin">Placement office</option>
        </select>
      </>}
      <div className="nav-scroll">{['Workspace', 'Career tools', 'Hiring', 'Insights', 'Placement office', 'Operations'].map(group => {
        const items = nav[role].filter(item => item.group === group);
        if (!items.length) return null;
        return <div className="nav-group" key={group}><div className="nav-group-label">{group}</div>{items.map(item => { const Icon = item.icon; return <Link key={item.path} href={item.path} className={`nav-item ${active?.path === item.path ? 'nav-active' : ''}`} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${item.path.split('/').filter(Boolean).join('-')}`}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Notifications' && <span className="nav-count">2</span>}</Link>; })}</div>;
      })}</div>
      <div className="sidebar-footer"><div className="avatar avatar-light">{mode === 'api' ? initials(auth?.fullName || 'Student') : role === 'student' ? 'AM' : role === 'recruiter' ? 'LR' : 'PO'}</div><div className="account-copy"><b>{mode === 'api' ? auth?.fullName || 'Student' : role === 'student' ? 'Aarav Mehta' : role === 'recruiter' ? 'Leena Rao' : 'Placement office'}</b><span>{mode === 'api' ? auth?.email : `${roleTitles[role]} · Demo`}</span></div><button type="button" className="icon-button" aria-label="Sign out" onClick={() => mode === 'api' ? void logout() : setLoc('/login')} data-testid="button-signout"><LogOut size={17} /></button></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} data-testid="button-close-navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation"><Menu size={20} /></button><div className="crumb">{roleTitles[role]} <span>/</span> {active?.label || 'Workspace'}</div><div className="topbar-right"><div className="mode-pill"><span className={`mode-dot ${mode === 'api' ? 'mode-dot-api' : ''}`} /><span>{mode === 'demo' ? 'Demo data' : 'API mode'}</span><button type="button" className="mode-switch" onClick={() => setMode(mode === 'demo' ? 'api' : 'demo')} data-testid="button-toggle-mode">{mode === 'demo' ? 'Use API' : 'Use demo'}</button></div><Link href={role === 'student' ? '/student/notifications' : role === 'admin' ? '/admin/settings' : '/recruiter/company'} className="top-icon" aria-label="Notifications or settings" data-testid="link-top-utility"><Bell size={18} /></Link><div className="avatar avatar-blue">{role === 'student' ? 'AM' : role === 'recruiter' ? 'LR' : 'PO'}</div></div></header>
      <div className="content-area">{mode === 'api' && <div className="api-banner" role="status"><ShieldAlert size={18} /><div><b>Live database mode</b><span>Pages in this workspace load from the authenticated PlaceMate API.</span></div><button type="button" className="text-action" onClick={() => setMode('demo')} data-testid="button-return-demo">Return to demo</button></div>}{logoutError && <div className="callout" role="alert">{logoutError}</div>}{children}</div>
    </main>
  </div>;
}

function Screen({ route }: { route: typeof routeMeta[number] }) {
  const pm = usePM();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  useEffect(() => {
    if (pm.mode === 'api' && (route.role === 'student' || route.role === 'admin') && !pm.authLoading && !pm.auth) {
      setLocation(route.role === 'admin' ? '/admin/login' : '/login');
    }
  }, [pm.mode, pm.authLoading, pm.auth, route.role, setLocation]);
  if (pm.mode === 'demo' && route.role && route.role !== pm.role) return <div className="standalone-state"><ShieldAlert size={28} /><h1>That workspace is restricted</h1><p>This browser role preview is not real authorization. Choose the matching demo role to explore this screen.</p><button className="button button-primary" onClick={() => setLocation('/unauthorized')} data-testid="button-view-unauthorized">View access details</button></div>;
  if (['landing', 'login', 'register', 'admin-login', 'unauthorized'].includes(route.kind)) return route.kind === 'admin-login'
    ? <AdminLoginPage onLogin={(user, csrf) => { pm.setSession(user, null, csrf); pm.setMode('api'); }} />
    : <PublicPage kind={route.kind} />;
  if (pm.mode === 'api') {
    if (pm.authLoading) return <div className="standalone-state" role="status">Restoring your secure session…</div>;
    if (!pm.auth) return <div className="standalone-state">Redirecting to sign in…</div>;
    if (route.role === 'admin' && pm.auth.role !== 'admin') return <div className="standalone-state"><h1>Administrator access required</h1><p>This account does not have administrator permissions.</p><button className="button button-secondary" onClick={() => setLocation('/admin/login')}>Sign in as administrator</button></div>;
    if (route.role === 'student' && pm.auth.role !== 'student') return <div className="standalone-state"><h1>Student access required</h1><p>This account cannot access the student workspace.</p></div>;
    if (route.role === 'admin') return <AdminWorkspacePage kind={route.kind} studentId={params.id || ''} />;
    if (route.role !== 'student') return <div className="api-empty page-enter"><h1>{route.title}</h1><p>Live recruiter workflows are not available yet. Demo data remains available separately.</p><button className="button button-secondary" onClick={() => pm.setMode('demo')}>Switch to demo workspace</button></div>;
    return <ApiStudentPage route={route} id={params.id || ''} />;
  }
  return <WorkspacePage route={route} id={params.id || ''} />;
}

function PublicPage({ kind }: { kind: string }) {
  const { setRole, mode, setMode } = usePM(); const [, setLocation] = useLocation();
  const [role, setLocalRole] = useState<Role>('student');
  const enter = (next: Role, destination?: string) => { setRole(next); setLocation(destination || nav[next][0].path); };
  if (kind === 'unauthorized') return <div className="auth-layout"><Brand /><section className="auth-card"><span className="auth-symbol"><ShieldAlert size={25} /></span><p className="eyebrow">ACCESS CONTROL</p><h1>Workspace unavailable</h1><p>Your selected demo role does not match this screen. Role previews demonstrate navigation only; they are not real authorization.</p><button className="button button-primary button-wide" onClick={() => setLocation('/')} data-testid="button-go-home">Return to PlaceMate</button></section></div>;
  if (kind === 'login' || kind === 'register') return mode === 'api'
    ? <RealAuthForm kind={kind} />
    : <div className="auth-layout"><Brand /><section className="auth-card"><Link href="/" className="back-link" data-testid="link-back-home"><ArrowLeft size={16} /> Back to overview</Link><p className="eyebrow">DEMO ACCESS</p><h1>{kind === 'login' ? 'Welcome back' : 'Create a demo account'}</h1><p className="auth-intro">{kind === 'login' ? 'Explore the placement workspace with one of the sample roles.' : 'Registration is represented as a role preview in this frontend demo.'}</p><label className="field-label" htmlFor="auth-role">Choose your workspace</label><select className="input" id="auth-role" value={role} onChange={e => setLocalRole(e.target.value as Role)} data-testid="select-auth-role"><option value="student">Student · Aarav Mehta</option><option value="recruiter">Recruiter · Leena Rao</option><option value="admin">Placement office</option></select><label className="field-label" htmlFor="auth-email">Email address</label><input className="input" id="auth-email" type="email" defaultValue={role === 'student' ? 'aarav.mehta@northstar.edu' : role === 'recruiter' ? 'leena@northstarsystems.example' : 'placement@northstar.edu'} data-testid="input-auth-email" /><label className="field-label" htmlFor="auth-password">Password</label><input className="input" id="auth-password" type="password" defaultValue="demo-access" data-testid="input-auth-password" /><button className="button button-primary button-wide" onClick={() => enter(role)} data-testid="button-auth-submit">{kind === 'login' ? 'Continue to demo' : 'Create demo workspace'} <ArrowRight size={16} /></button><div className="demo-caveat">Demo access only. Credentials are not verified and no account is created.</div><p className="auth-switch">{kind === 'login' ? 'New to PlaceMate?' : 'Already exploring?'} <Link href={kind === 'login' ? '/register' : '/login'} data-testid="link-auth-switch">{kind === 'login' ? 'Register' : 'Sign in'}</Link></p><button className="text-action" type="button" onClick={() => setMode('api')}>Use a real student account</button><p className="auth-switch"><Link href="/admin/login">Administrator sign in</Link></p></section><div className="auth-foot">PlaceMate · Campus careers, in one place</div></div>;
  return <div className="landing page-enter"><header className="landing-nav"><Brand /><div className="landing-nav-actions"><span className="landing-demo"><span className="live-dot" /> Demo workspace</span><Link href="/login" className="button button-outline" data-testid="link-login">Sign in</Link><Link href="/register" className="button button-primary" data-testid="link-register">Open demo <ArrowRight size={15} /></Link></div></header><section className="landing-hero"><div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> PLACEMENT INTELLIGENCE, CONNECTED</p><h1>Every placement,<br /><em>in perspective.</em></h1><p className="hero-lede">One considered workspace for students finding their next role, recruiters building a stronger pipeline, and placement teams seeing the whole picture.</p><div className="hero-actions"><Link href="/login" className="button button-primary button-large" data-testid="link-explore-demo">Explore the demo <ArrowRight size={17} /></Link><a href="#workspaces" className="hero-secondary" data-testid="link-see-workspaces">See the workspaces <ArrowDown size={16} /></a></div><div className="hero-proof"><div className="proof-avatars"><span>AM</span><span>LR</span><span>PO</span></div><div><b>One connected campus workflow</b><small>Clearly labeled synthetic demo records</small></div></div></div><div className="hero-visual"><div className="visual-grid" /><div className="dashboard-preview"><div className="preview-top"><div className="preview-brand"><span className="brand-mark small"><GraduationCap size={15} /></span> placemate</div><span className="preview-tag">DEMO DATA</span></div><div className="preview-greeting"><small>STUDENT OVERVIEW</small><b>Good morning, Aarav</b><span>Here’s where your search stands.</span></div><div className="preview-metrics"><div><small>Applications</small><b>3</b><span>Across 3 companies</span></div><div><small>In progress</small><b>2</b><span>One upcoming interview</span></div></div><div className="preview-chart"><div className="chart-ring"><span>03</span></div><div className="chart-legend"><span><i className="legend-indigo" /> In review <b>1</b></span><span><i className="legend-green" /> Interview <b>1</b></span><span><i className="legend-orange" /> Waiting <b>1</b></span></div></div><div className="preview-row"><span className="company-mark">N</span><div><b>Associate Software Engineer</b><small>Northstar Systems</small></div><span className="status status-blue">Interview scheduled</span></div></div><div className="visual-note"><span className="live-dot" /> Connected from first application to final outcome</div></div></section><section className="landing-strip"><span>BUILT FOR THE FULL PLACEMENT CYCLE</span><div><span><GraduationCap size={17} /> Students</span><span><Building2 size={17} /> Recruiters</span><span><Activity size={17} /> Placement teams</span></div></section><section className="workspaces-section" id="workspaces"><div className="section-heading"><p className="eyebrow">THREE PERSPECTIVES. ONE SHARED PICTURE.</p><h2>Built around the work<br />that actually gets done.</h2><p>Purpose-specific workflows share a consistent source of placement information.</p></div><div className="workspace-list">{[{ role: 'student' as Role, num: '01', title: 'For students', copy: 'Discover roles, keep applications moving, and prepare for the conversations ahead.', labels: 'Jobs · Application history · Interviews' }, { role: 'recruiter' as Role, num: '02', title: 'For recruiters', copy: 'Manage open roles and candidate progress without losing context across the hiring cycle.', labels: 'Job management · Candidate review · Hiring insights' }, { role: 'admin' as Role, num: '03', title: 'For placement teams', copy: 'Classify student cohorts, coordinate drives, and understand outcomes in one view.', labels: 'Student intelligence · Drives · Outcomes' }].map(item => <button key={item.role} className="workspace-row" onClick={() => enter(item.role)} data-testid={`button-open-${item.role}-workspace`}><span className="workspace-num">{item.num}</span><span className="workspace-copy"><b>{item.title}</b><small>{item.copy}</small><em>{item.labels}</em></span><span className="workspace-arrow"><ArrowRight size={19} /></span></button>)}</div></section><section className="data-note"><span className="note-symbol"><ShieldAlert size={20} /></span><div><b>A transparent demo, by design.</b><p>Every dashboard and chart is derived from one fictional, locally editable dataset. Eligibility and resume review are not presented as verified server decisions. API mode stays separate until a contract is available.</p></div><Link href="/login" data-testid="link-open-demo-note">Open demo <ArrowRight size={16} /></Link></section><footer className="landing-footer"><Brand /><span>Northstar University · Placement workspace demo · 2026</span><Link href="/login" data-testid="link-footer-demo">Explore workspace</Link></footer></div>;
}

function RealAuthForm({ kind }: { kind: 'login' | 'register' }) {
  const { setSession, authRestoreError } = usePM();
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') || '');
    if (kind === 'register' && password !== String(data.get('confirmPassword') || '')) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }
    try {
      const body = kind === 'login'
        ? { email: String(data.get('email')), password }
        : {
            fullName: String(data.get('fullName')),
            email: String(data.get('email')),
            password,
            course: String(data.get('course')),
            department: String(data.get('department')),
            graduationYear: Number(data.get('graduationYear')),
          };
      const result = await apiRequest<{ user: AuthUser; student?: ApiStudent; csrfToken: string }>(
        `/auth/${kind}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (result.student) {
        setSession(result.user, result.student, result.csrfToken);
      } else {
        const current = await apiRequest<{ user: AuthUser; student: ApiStudent; csrfToken: string | null }>('/auth/me');
        setSession(current.user, current.student, current.csrfToken);
      }
      setLocation('/student');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-layout"><Brand /><section className="auth-card">
    <Link href="/" className="back-link" data-testid="link-back-home"><ArrowLeft size={16} /> Back to overview</Link>
    <p className="eyebrow">LIVE STUDENT ACCOUNT</p>
    <h1>{kind === 'login' ? 'Welcome back' : 'Create your account'}</h1>
    <p className="auth-intro">{kind === 'login' ? 'Sign in securely to continue to your placement workspace.' : 'Your profile and permanent student number are stored by PlaceMate.'}</p>
    {authRestoreError && <p className="form-error" role="status">{authRestoreError}</p>}
    <form onSubmit={submit}>
      {kind === 'register' && <>
        <label className="field-label" htmlFor="auth-name">Full name</label>
        <input className="input" id="auth-name" name="fullName" autoComplete="name" required minLength={2} maxLength={120} />
      </>}
      <label className="field-label" htmlFor="auth-email">Email address</label>
      <input className="input" id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} />
      {kind === 'register' && <>
        <div className="form-row">
          <div><label className="field-label" htmlFor="auth-course">Course</label><input className="input" id="auth-course" name="course" required maxLength={100} /></div>
          <div><label className="field-label" htmlFor="auth-department">Department</label><input className="input" id="auth-department" name="department" required maxLength={120} /></div>
        </div>
        <label className="field-label" htmlFor="auth-year">Graduation year (2000–2099)</label>
        <input className="input" id="auth-year" name="graduationYear" type="number" min="2000" max="2099" required />
      </>}
      <label className="field-label" htmlFor="auth-password">Password</label>
      <input className="input" id="auth-password" name="password" type="password" autoComplete={kind === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={72} />
      {kind === 'register' && <>
        <label className="field-label" htmlFor="auth-confirm-password">Confirm password</label>
        <input className="input" id="auth-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" type="submit" disabled={busy} data-testid="button-auth-submit">{busy ? 'Please wait…' : kind === 'login' ? 'Sign in' : 'Create student account'} <ArrowRight size={16} /></button>
    </form>
    <p className="auth-switch">{kind === 'login' ? 'New to PlaceMate?' : 'Already registered?'} <Link href={kind === 'login' ? '/register' : '/login'} data-testid="link-auth-switch">{kind === 'login' ? 'Create account' : 'Sign in'}</Link></p>
    {kind === 'login' && <p className="auth-switch"><Link href="/admin/login">Placement office sign in</Link></p>}
    <button className="text-action" type="button" onClick={() => { localStorage.setItem('placemate-mode', 'demo'); window.location.reload(); }}>Switch to clearly labeled demo mode</button>
  </section><div className="auth-foot">PlaceMate · Secure student account</div></div>;
}

function ApiStudentPage({ route, id }: { route: typeof routeMeta[number]; id: string }) {
  const { student, auth, setSession } = usePM();
  const [, setLocation] = useLocation();
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [selectedJob, setSelectedJob] = useState<ApiJob | null>(null);
  const [profile, setProfile] = useState<ApiStudent | null>(student);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      if (route.kind === 'jobs') {
        const [jobResult, applicationResult] = await Promise.all([
          apiRequest<{ jobs: ApiJob[] }>('/jobs'),
          apiRequest<{ applications: ApiApplication[] }>('/applications/me'),
        ]);
        setJobs(jobResult.jobs);
        setApplications(applicationResult.applications);
      } else if (route.kind === 'job-detail') {
        const [jobResult, applicationResult] = await Promise.all([
          apiRequest<{ job: ApiJob }>(`/jobs/${encodeURIComponent(id)}`),
          apiRequest<{ applications: ApiApplication[] }>('/applications/me'),
        ]);
        setSelectedJob(jobResult.job);
        setApplications(applicationResult.applications);
      } else if (route.kind === 'applications' || route.kind === 'student-home') {
        const [apps, availableJobs] = await Promise.all([
          apiRequest<{ applications: ApiApplication[] }>('/applications/me'),
          apiRequest<{ jobs: ApiJob[] }>('/jobs'),
        ]);
        setApplications(apps.applications);
        setJobs(availableJobs.jobs);
      } else if (route.kind === 'profile') {
        const result = await apiRequest<{ student: ApiStudent }>('/students/me');
        setProfile(result.student);
      } else {
        setNotice('This student workflow is not part of the current live MVP.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load live records.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, [route.kind, id]);

  const apply = async (jobId: string) => {
    setError('');
    setNotice('');
    try {
      await apiRequest('/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
      setNotice('Application saved successfully.');
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit application.');
    }
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ student: ApiStudent }>('/students/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: String(data.get('fullName')),
          course: String(data.get('course')),
          department: String(data.get('department')),
          cgpa: Number(data.get('cgpa')),
          skills: String(data.get('skills')).split(',').map(value => value.trim()).filter(Boolean),
          interests: String(data.get('interests')).split(',').map(value => value.trim()).filter(Boolean),
        }),
      });
      setProfile(result.student);
      if (auth) setSession({ ...auth, fullName: result.student.fullName }, result.student);
      setNotice('Profile saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save profile.');
    }
  };

  const heading = route.kind === 'student-home' ? 'Your placement journey'
    : route.kind === 'jobs' ? 'Browse published jobs'
    : route.kind === 'job-detail' ? 'Job details'
    : route.kind === 'applications' ? 'Your applications'
    : route.kind === 'profile' ? 'Your profile'
    : route.title;
  const applied = new Set(applications.map(application => application.jobId));
  return <section className="page-enter">
    <div className="page-heading"><div><p className="eyebrow">LIVE DATABASE</p><h1>{heading}</h1><p>{student?.studentNumber} · Class of {student?.graduationYear}</p></div></div>
    {error && <div className="callout" role="alert"><ShieldAlert size={17} /><span>{error}</span></div>}
    {notice && <div className="callout" role="status"><Check size={17} /><span>{notice}</span></div>}
    {loading && <div className="standalone-state" role="status">Loading your saved PlaceMate records…</div>}
    {!loading && route.kind === 'student-home' && <div className="metric-grid">
      {[{ label: 'Applications', value: applications.length }, { label: 'Open jobs', value: jobs.length }, { label: 'In progress', value: applications.filter(item => ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled'].includes(item.status)).length }, { label: 'Selected', value: applications.filter(item => item.status === 'Selected').length }].map(metric => <article className="metric-card" key={metric.label}><span className="metric-label">{metric.label}</span><b>{metric.value}</b><small>From your database account</small></article>)}
      <section className="panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Saved application history</p></div><Link href="/student/applications" className="subtle-link">View all <ArrowRight size={15} /></Link></div>{applications.slice(0, 5).map(item => <p key={item.id}><b>{item.jobTitle}</b> · {item.company} · {item.status}</p>)}{applications.length === 0 && <Empty title="No applications yet" detail="Browse published jobs to get started." link="/student/jobs" linkText="Browse jobs" />}</section>
    </div>}
    {!loading && (route.kind === 'jobs' || route.kind === 'job-detail') && <div className="jobs-list">
      {(route.kind === 'job-detail' && selectedJob ? [selectedJob] : jobs).map(job => <article className="job-card" key={job.id}>
        <div className="company-mark">{job.company.slice(0, 1)}</div><div className="job-card-main"><Link className="job-title" href={`/student/jobs/${job.id}`}>{job.title}</Link><p>{job.company} · {job.location}</p><div className="job-tags"><span>{job.category}</span><span>Class of {job.year}</span><span>{job.courses.join(', ') || 'All courses'}</span><span>CGPA {job.minCgpa}+</span></div><p>{job.description}</p></div><div className="job-card-side"><b>₹{job.package} LPA</b><small>Apply by {new Date(job.deadline).toLocaleDateString()}</small><button className="button button-primary button-small" disabled={applied.has(job.id)} onClick={() => void apply(job.id)}>{applied.has(job.id) ? 'Applied' : 'Apply'}</button></div>
      </article>)}
      {route.kind === 'jobs' && jobs.length === 0 && <Empty title="No published jobs yet" detail="New roles will appear here when the placement team publishes them." />}
      {route.kind === 'job-detail' && !selectedJob && !loading && <Empty title="Job not found" detail="This job is unavailable or not published." link="/student/jobs" linkText="Browse jobs" />}
    </div>}
    {!loading && route.kind === 'applications' && <div className="table-wrap"><table><thead><tr><th>Job</th><th>Company</th><th>Applied</th><th>Status</th></tr></thead><tbody>{applications.map(item => <tr key={item.id}><td>{item.jobTitle}</td><td>{item.company}</td><td>{new Date(item.date).toLocaleDateString()}</td><td>{item.status}</td></tr>)}</tbody></table>{applications.length === 0 && <Empty title="No applications yet" detail="Your applications will be saved here." link="/student/jobs" linkText="Browse jobs" />}</div>}
    {!loading && route.kind === 'profile' && profile && <form className="form-page panel" onSubmit={saveProfile}>
      <label className="field-label">Permanent student number</label><input className="input" value={profile.studentNumber} readOnly />
      <label className="field-label" htmlFor="profile-name">Full name</label><input className="input" id="profile-name" name="fullName" defaultValue={profile.fullName} required />
      <div className="form-row"><div><label className="field-label" htmlFor="profile-course">Course</label><input className="input" id="profile-course" name="course" defaultValue={profile.course} required /></div><div><label className="field-label" htmlFor="profile-department">Department</label><input className="input" id="profile-department" name="department" defaultValue={profile.department} required /></div></div>
      <label className="field-label">Graduation year (permanent)</label><input className="input" value={profile.graduationYear} readOnly />
      <label className="field-label" htmlFor="profile-cgpa">CGPA</label><input className="input" id="profile-cgpa" name="cgpa" type="number" min="0" max="10" step="0.01" defaultValue={profile.cgpa} required />
      <label className="field-label" htmlFor="profile-skills">Skills (comma separated)</label><input className="input" id="profile-skills" name="skills" defaultValue={profile.skills.join(', ')} />
      <label className="field-label" htmlFor="profile-interests">Interests (comma separated)</label><input className="input" id="profile-interests" name="interests" defaultValue={profile.interests.join(', ')} />
      <button className="button button-primary" type="submit">Save profile</button>
    </form>}
    {!loading && !['student-home', 'jobs', 'job-detail', 'applications', 'profile'].includes(route.kind) && <div className="standalone-state">{notice}</div>}
  </section>;
}
function Brand() { return <Link href="/" className="brand brand-public" data-testid="link-brand-home"><span className="brand-mark"><GraduationCap size={20} /></span><span>placemate<span className="brand-period">.</span></span></Link>; }

function WorkspacePage({ route, id }: { route: typeof routeMeta[number]; id: string }) {
  const { demo, updateDemo, role } = usePM();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All'); const [placementFilter, setPlacementFilter] = useState('All'); const [jobLocation, setJobLocation] = useState('All locations'); const [jobCourse, setJobCourse] = useState('All courses'); const [packageBand, setPackageBand] = useState('Any package'); const [page, setPage] = useState(1); const [modal, setModal] = useState(false); const [notice, setNotice] = useState(''); const [sort, setSort] = useState<'name' | 'newest'>('newest');
  const setNoticeFor = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };
  const openJob = demo.jobs.find(j => j.id === id);
  const selectedStudent = demo.students.find(s => s.id === id);
  const selectedApp = demo.applications.find(a => a.id === id);
  const isStudent = role === 'student'; const isRecruiter = role === 'recruiter'; const isAdmin = role === 'admin';
  const student = demo.students[0];
  const allApps = isStudent ? demo.applications.filter(a => a.studentId === student.id) : isRecruiter ? demo.applications.filter(a => demo.jobs.some(j => j.id === a.jobId && j.companyId === 'co-1')) : demo.applications;
  const jobs = isRecruiter ? demo.jobs.filter(j => j.companyId === 'co-1') : demo.jobs;
  const companiesById = useMemo(() => Object.fromEntries(demo.companies.map(c => [c.id, c])), [demo.companies]);
  const title = route.title;
  const applyFor = (job: Job) => {
    if (job.status !== 'Open') return;
    if (demo.applications.some(a => a.studentId === student.id && a.jobId === job.id)) { setNoticeFor('You have already applied to this role.'); return; }
    const date = new Date().toISOString().slice(0, 10);
    const application: Application = { id: `app-${Date.now()}`, studentId: student.id, jobId: job.id, date, status: 'Applied', history: [{ status: 'Applied', date, note: 'Application submitted in the PlaceMate demo' }] };
    updateDemo({ ...demo, applications: [application, ...demo.applications] }); setNoticeFor('Demo application added to your tracker.');
  };
  const toggleSaved = (jobId: string) => updateDemo({ ...demo, savedJobs: demo.savedJobs.includes(jobId) ? demo.savedJobs.filter(x => x !== jobId) : [...demo.savedJobs, jobId] });
  const updateStatus = (applicationId: string, status: AppStatus) => {
    const date = new Date().toISOString().slice(0, 10);
    updateDemo({ ...demo, applications: demo.applications.map(app => app.id === applicationId ? { ...app, status, history: [...app.history, { status, date, note: `Status changed to ${status} in the demo workspace` }] } : app) });
    setNoticeFor(`Application status updated to ${status}.`);
  };
  const selectedJob = openJob;
  let headingDescription = 'A clear view of the work in progress.';
  const pageDesc: Record<string, string> = { 'student-home': 'Your applications, upcoming conversations, and next steps in one place.', jobs: 'Explore current openings shared with the Northstar University cohort.', applications: 'Follow every application from submission through outcome.', interviews: 'Upcoming conversations and interview details.', profile: 'Keep the academic and career information you share with employers current.', resume: 'Resume feedback appears here when a real review is available.', 'career-guide': 'A practical set of next steps to strengthen your placement preparation.', notifications: 'Updates connected to your placement activity.', 'recruiter-home': 'A focused view of open roles and candidate progress.', 'recruiter-jobs': 'Create, update, and review your company’s placement openings.', 'recruiter-applicants': 'Review candidates across your active placement roles.', analytics: 'Hiring outcomes calculated from this workspace’s demo records.', 'admin-home': 'A live overview of student, company, and placement activity.', students: 'Search and segment the cohort using the available academic and career fields.', classification: 'Inspect job criteria alongside student records. This demo preview is not an eligibility decision.', companies: 'Company and recruiter contacts participating in this demo cycle.', drives: 'Coordinate placement openings and drive readiness.', settings: 'Demo environment controls and data-handling notes.' };
  headingDescription = pageDesc[route.kind] || headingDescription;

  const filterData = <T extends { id: string }>(items: T[], text: (item: T) => string) => items.filter(item => text(item).toLowerCase().includes(query.toLowerCase())).filter(item => filter === 'All' || text(item).includes(filter));
  const listJobs = filterData(jobs.filter(job => isRecruiter || job.status === 'Open'), job => `${job.title} ${companiesById[job.companyId]?.name} ${job.location} ${job.category} ${job.skills.join(' ')} ${demo.savedJobs.includes(job.id) ? 'Saved' : ''}`)
    .filter(job => jobLocation === 'All locations' || job.location === jobLocation)
    .filter(job => jobCourse === 'All courses' || job.courses.includes(jobCourse))
    .filter(job => packageBand === 'Any package' || (packageBand === 'Under ₹10 LPA' ? job.package < 10 : packageBand === '₹10–12 LPA' ? job.package >= 10 && job.package <= 12 : job.package > 12));
  const appRows = filterData(allApps, app => `${companiesById[demo.jobs.find(j => j.id === app.jobId)?.companyId || '']?.name || ''} ${demo.jobs.find(j => j.id === app.jobId)?.title || ''} ${app.status}`);
  const studentRows = filterData(demo.students, s => `${s.name} ${s.id} ${s.course} ${s.department} ${s.skills.join(' ')}`).filter(s => placementFilter === 'All' || (placementFilter === 'Placed' ? s.placed : !s.placed));
  const companyRows = filterData(demo.companies, c => `${c.name} ${c.industry} ${c.location} ${c.recruiter}`);
  const interviewRows = demo.interviews.filter(i => {
    const app = demo.applications.find(a => a.id === i.applicationId); const job = demo.jobs.find(j => j.id === app?.jobId); const target = isStudent ? app?.studentId === student.id : isRecruiter ? job?.companyId === 'co-1' : true;
    return Boolean(target) && isUpcoming(i.date) && `${job?.title || ''} ${companiesById[job?.companyId || '']?.name || ''} ${i.type} ${i.location}`.toLowerCase().includes(query.toLowerCase());
  });
  const paginate = <T,>(items: T[]) => { const size = 6; const pages = Math.max(1, Math.ceil(items.length / size)); return { items: items.slice((page - 1) * size, page * size), pages }; };
  const pagedApps = paginate(appRows); const pagedJobs = paginate(listJobs); const pagedStudents = paginate(studentRows); const pagedCompanies = paginate(companyRows);
  const rowsApps = [...pagedApps.items].sort((a, b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.status.localeCompare(b.status));
  const rowsJobs = [...pagedJobs.items].sort((a, b) => sort === 'newest' ? a.deadline.localeCompare(b.deadline) : a.title.localeCompare(b.title));
  const rowsStudents = [...pagedStudents.items].sort((a, b) => sort === 'newest' ? a.name.localeCompare(b.name) : b.cgpa - a.cgpa);
  const rowsCompanies = pagedCompanies.items;

  const tablePage = (placeholder: string, filterOptions: string[] = ['All']) => <div className="table-tools"><label className="search-box"><Search size={17} /><input aria-label="Search records" placeholder={placeholder} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} data-testid="input-search-records" /></label><select className="compact-select" aria-label="Filter records" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} data-testid="select-filter-records">{filterOptions.map(x => <option key={x}>{x}</option>)}</select><select className="compact-select sort-select" aria-label="Sort records" value={sort} onChange={e => setSort(e.target.value as 'name' | 'newest')} data-testid="select-sort-records"><option value="newest">Recent first</option><option value="name">Name / status</option></select></div>;
  const pagination = (current: number, pages: number) => <div className="pagination"><span>Page {current} of {pages}</span><div><button className="pagination-button" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page" data-testid="button-previous-page">‹</button><button className="pagination-button" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page" data-testid="button-next-page">›</button></div></div>;
  const statusBadge = (value: AppStatus | string) => <span className={`status status-${value.toLowerCase().replaceAll(' ', '-')}`} data-testid={`status-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>;
  const jobCard = (job: Job) => {
    const company = companiesById[job.companyId];
    const alreadyApplied = demo.applications.some(a => a.studentId === student.id && a.jobId === job.id);
    return <article className="job-card" key={job.id} data-testid={`card-job-${job.id}`}><div className="company-mark">{company?.name.slice(0, 1) || 'C'}</div><div className="job-card-main"><div className="job-title-row"><Link href={isRecruiter ? `/recruiter/jobs/${job.id}/edit` : isAdmin ? '/admin/drives' : `/student/jobs/${job.id}`} className="job-title" data-testid={`link-job-${job.id}`}>{job.title}</Link>{isRecruiter && <span className={`status ${job.status === 'Open' ? 'status-selected' : 'status-under-review'}`}>{job.status}</span>}</div><p>{company?.name} <span>·</span> {job.location}</p><div className="job-tags"><span>{job.category}</span><span>{job.courses.join(', ')}</span><span>{job.skills.slice(0, 2).join(' · ')}</span></div></div><div className="job-card-side"><b>₹{job.package} LPA</b><small>Apply by {prettyDate(job.deadline)}</small>{isStudent && <div className="job-card-actions"><button className="button button-quiet" onClick={() => toggleSaved(job.id)} data-testid={`button-save-job-${job.id}`} aria-label={`${demo.savedJobs.includes(job.id) ? 'Unsave' : 'Save'} ${job.title}`}>{demo.savedJobs.includes(job.id) ? 'Saved' : 'Save'}</button><button className="button button-primary button-small" disabled={alreadyApplied} onClick={() => applyFor(job)} data-testid={`button-apply-job-${job.id}`}>{alreadyApplied ? 'Applied' : 'Apply'}</button></div>}{isRecruiter && <div className="job-card-actions"><Link className="button button-outline button-small" href={`/recruiter/jobs/${job.id}/edit`} data-testid={`link-edit-job-${job.id}`}>Edit</Link><button className="button button-quiet button-small" onClick={() => { if (window.confirm(`Delete ${job.title} from the demo workspace? Applications already recorded will remain in history.`)) updateDemo({ ...demo, jobs: demo.jobs.filter(item => item.id !== job.id) }); }} data-testid={`button-delete-job-${job.id}`}>Delete</button></div>}</div></article>;
  };
  const appTable = (items: Application[], admin = false) => <div className="table-wrap"><table><thead><tr><th>{admin || isRecruiter ? 'Student' : 'Role'}</th><th>{admin || isRecruiter ? 'Role' : 'Company'}</th><th>Applied</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{items.map(app => {
    const job = demo.jobs.find(j => j.id === app.jobId); const company = companiesById[job?.companyId || '']; const person = demo.students.find(s => s.id === app.studentId);
    return <tr key={app.id} data-testid={`row-application-${app.id}`}><td><Link className="table-primary-link" href={admin ? `/admin/students/${person?.id}` : isRecruiter ? `/recruiter/applicants/${person?.id}` : `/student/applications/${app.id}`} data-testid={`link-application-primary-${app.id}`}>{admin || isRecruiter ? person?.name : job?.title}</Link><small className="table-sub">{admin || isRecruiter ? person?.id : app.id}</small></td><td>{admin || isRecruiter ? job?.title : company?.name}<small className="table-sub">{admin || isRecruiter ? company?.name : job?.location}</small></td><td>{prettyDate(app.date)}</td><td>{statusBadge(app.status)}</td><td><Link className="row-arrow" href={isStudent ? `/student/applications/${app.id}` : `/recruiter/applicants/${person?.id}`} aria-label="Open record" data-testid={`link-open-application-${app.id}`}><ArrowRight size={16} /></Link></td></tr>;
  })}</tbody></table>{items.length === 0 && <Empty title="No matching applications" detail="Try a different search or clear the current filters." />}</div>;
  const jobList = (items: Job[]) => <div className="jobs-list">{items.map(jobCard)}{items.length === 0 && <Empty title="No roles match those filters" detail="Adjust the search or explore all open roles." />}</div>;
  const studentTable = (items: Student[]) => <div className="table-wrap"><table><thead><tr><th>Student</th><th>Course / department</th><th>CGPA</th><th>Profile</th><th>Placement</th><th /></tr></thead><tbody>{items.map(s => <tr key={s.id} data-testid={`row-student-${s.id}`}><td><Link href={`/admin/students/${s.id}`} className="table-primary-link" data-testid={`link-student-${s.id}`}>{s.name}</Link><small className="table-sub">{s.id}</small></td><td>{s.course}<small className="table-sub">{s.department}</small></td><td>{s.cgpa.toFixed(1)}</td><td><div className="completion"><span style={{ width: `${s.completion}%` }} /><b>{s.completion}%</b></div></td><td>{s.placed ? <span className="status status-selected">Placed</span> : <span className="status status-muted">Seeking</span>}</td><td><Link className="row-arrow" href={`/admin/students/${s.id}`} aria-label={`View ${s.name}`} data-testid={`link-view-student-${s.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table>{items.length === 0 && <Empty title="No students found" detail="Try another name, course or skill." />}</div>;
  const interviewTable = <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Role & company</th><th>Date & time</th><th>Format</th><th>Location</th></tr></thead><tbody>{interviewRows.map(i => { const app = demo.applications.find(a => a.id === i.applicationId); const job = demo.jobs.find(j => j.id === app?.jobId); const person = demo.students.find(s => s.id === app?.studentId); return <tr key={i.id} data-testid={`row-interview-${i.id}`}><td>{isStudent ? 'You · Aarav Mehta' : person?.name}<small className="table-sub">{app?.id}</small></td><td>{job?.title}<small className="table-sub">{companiesById[job?.companyId || '']?.name}</small></td><td>{prettyDate(i.date)}<small className="table-sub">{i.time}</small></td><td>{i.type}</td><td>{i.location}</td></tr>; })}</tbody></table>{interviewRows.length === 0 && <Empty title="No interviews scheduled" detail="Scheduled conversations will appear here." />}</div>;
  const chartData = statuses.map(status => ({ name: status, value: allApps.filter(a => a.status === status).length })).filter(x => x.value > 0);
  const homeDashboard = (adminView: boolean) => {
    const apps = adminView ? demo.applications : demo.applications.filter(a => a.studentId === student.id);
    const placedCount = demo.students.filter(s => s.placed).length;
    const metrics = adminView ? [{ label: 'Students', value: demo.students.length, hint: 'In the demo cohort', icon: Users }, { label: 'Active companies', value: demo.companies.length, hint: 'Recruiters in this cycle', icon: Building2 }, { label: 'Open roles', value: demo.jobs.filter(j => j.status === 'Open').length, hint: 'Across participating companies', icon: BriefcaseBusiness }, { label: 'Total applications', value: demo.applications.length, hint: 'Across all demo roles', icon: ClipboardList }, { label: 'Students placed', value: placedCount, hint: 'Unique students with selection', icon: Check }] : [{ label: 'Applications', value: apps.length, hint: 'Across your active search', icon: ClipboardList }, { label: 'In progress', value: apps.filter(a => ['Under Review', 'Shortlisted', 'Interview Scheduled'].includes(a.status)).length, hint: 'Review or interview stage', icon: Activity }, { label: 'Waiting for result', value: apps.filter(a => a.status === 'Waiting for Result').length, hint: 'Decision pending', icon: CalendarDays }, { label: 'Selected', value: apps.filter(a => a.status === 'Selected').length, hint: 'Confirmed outcomes', icon: Check }];
    return <><div className="metric-grid">{metrics.map((m, i) => { const Icon = m.icon; return <article className="metric-card" key={m.label} data-testid={`metric-${m.label.toLowerCase().replaceAll(' ', '-')}`}><span className={`metric-icon metric-icon-${i % 4}`}><Icon size={18} /></span><span className="metric-label">{m.label}</span><b>{m.value}</b><small>{m.hint}</small></article>; })}</div>{!adminView && <div className="student-quick-stats">{[{ label: 'Under review', value: apps.filter(a => a.status === 'Under Review').length }, { label: 'Shortlisted', value: apps.filter(a => a.status === 'Shortlisted').length }, { label: 'Rejections', value: apps.filter(a => a.status === 'Rejected').length }, { label: 'Interviews', value: demo.interviews.filter(i => isUpcoming(i.date) && apps.some(a => a.id === i.applicationId)).length }, { label: 'Selected rate', value: `${apps.length ? ((apps.filter(a => a.status === 'Selected').length / apps.length) * 100).toFixed(1) : '0.0'}%` }].map(item => <div key={item.label}><small>{item.label}</small><b>{item.value}</b></div>)}</div>}<div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>{adminView ? 'Application outcomes' : 'Your application mix'}</h2><p>{adminView ? 'Current status across submitted applications' : 'A snapshot of where your applications stand'}</p></div><Link href={adminView ? '/admin/analytics' : '/student/applications'} className="subtle-link" data-testid="link-dashboard-all-applications">View all <ArrowRight size={15} /></Link></div>{chartData.length ? <div className="chart-area"><div className="donut-box"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={3} stroke="none">{chartData.map((entry, index) => <Cell key={entry.name} fill={['#4659bb', '#7381d0', '#2c9474', '#dc9c4a', '#789eb8', '#319876', '#c66b73', '#9aa5b6'][statuses.indexOf(entry.name as AppStatus) % 8]} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer><div className="donut-center"><b>{apps.length}</b><small>applications</small></div></div><div className="chart-legend">{chartData.map(item => <div key={item.name}><span className="legend-dot" style={{ backgroundColor: ['#4659bb', '#7381d0', '#2c9474', '#dc9c4a', '#789eb8', '#319876', '#c66b73', '#9aa5b6'][statuses.indexOf(item.name as AppStatus) % 8]}} />{item.name}<b>{item.value}</b></div>)}</div></div> : <Empty title="No application activity yet" detail="Application outcomes will appear here as records are added." />}</section><section className="panel next-panel"><div className="panel-heading"><div><h2>{adminView ? 'Placement pulse' : 'Coming up next'}</h2><p>{adminView ? 'Signals from the current demo cohort' : 'Your next scheduled conversation'}</p></div></div>{adminView ? <><div className="pulse-line"><span>Placement rate</span><b>{demo.students.length ? `${((placedCount / demo.students.length) * 100).toFixed(1)}%` : '—'}</b></div><p className="definition-note">Unique students with a Selected application ÷ students in the cohort. Fixture values are demo-only.</p><div className="pulse-line"><span>Applications recorded</span><b>{demo.applications.length}</b></div><div className="pulse-line"><span>Interviews scheduled</span><b>{demo.interviews.length}</b></div></> : <>{demo.interviews.filter(i => isUpcoming(i.date) && demo.applications.find(a => a.id === i.applicationId)?.studentId === student.id).length ? demo.interviews.filter(i => isUpcoming(i.date) && demo.applications.find(a => a.id === i.applicationId)?.studentId === student.id).map(i => { const app = demo.applications.find(a => a.id === i.applicationId); const job = demo.jobs.find(j => j.id === app?.jobId); return <div className="upcoming-item" key={i.id}><div className="date-block"><b>{new Date(`${i.date}T12:00:00`).getDate()}</b><small>{new Date(`${i.date}T12:00:00`).toLocaleString('en', { month: 'short' })}</small></div><div><b>{i.type}</b><span>{companiesById[job?.companyId || '']?.name} · {i.time}</span><small>{i.location}</small></div></div>; }) : <Empty title="Nothing scheduled yet" detail="New interview invitations will appear here." />}</>}</section></div><div className="section-row"><div className="section-title"><div><h2>{adminView ? 'Recent applications' : 'Recent applications'}</h2><p>Latest activity from the shared demo fixture.</p></div><Link href={adminView ? '/admin/applications' : '/student/applications'} className="subtle-link" data-testid="link-view-applications">View applications <ArrowRight size={15} /></Link></div>{appTable([...apps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), adminView)}</div>{!adminView && <div className="section-row"><div className="section-title"><div><h2>Roles to explore</h2><p>Open positions from participating companies.</p></div><Link href="/student/jobs" className="subtle-link" data-testid="link-browse-jobs">Browse all jobs <ArrowRight size={15} /></Link></div>{jobList(demo.jobs.filter(j => j.status === 'Open').slice(0, 2))}<div className="profile-summary"><div className="profile-mini"><span className="avatar avatar-blue">AM</span><div><b>Profile completeness</b><small>Your profile is ready for more visibility.</small></div></div><div className="completion wide"><span style={{ width: `${student.completion}%` }} /><b>{student.completion}%</b></div><Link href="/student/profile" className="text-action" data-testid="link-complete-profile">Review profile <ArrowRight size={15} /></Link></div><section className="career-summary"><span className="career-icon"><Sparkles size={18} /></span><div><b>One small next step</b><p>Add one project outcome with a measurable result to give recruiters useful context. <Link href="/student/career-guide" data-testid="link-career-next-step">Open career guide</Link></p></div></section></div>}</>;
  };

  const onJobSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const job: Job = { id: `job-${Date.now()}`, title: String(data.get('title')), companyId: 'co-1', location: String(data.get('location')), category: String(data.get('category')), package: Number(data.get('package')), deadline: String(data.get('deadline')), year: 2026, minCgpa: Number(data.get('cgpa')), courses: ['B.Tech', 'M.Tech'], skills: String(data.get('skills')).split(',').map(s => s.trim()).filter(Boolean), description: String(data.get('description')), status: 'Open' };
    updateDemo({ ...demo, jobs: [job, ...demo.jobs] }); setModal(false); setNoticeFor('Job posting created in demo mode.');
  };
  const onInterviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const interview = { id: `int-${Date.now()}`, applicationId: String(data.get('application')), date: String(data.get('date')), time: String(data.get('time')), type: String(data.get('type')), location: String(data.get('location')) };
    const app = demo.applications.find(a => a.id === interview.applicationId);
    const updated: DemoState = { ...demo, interviews: [interview, ...demo.interviews], applications: app ? demo.applications.map(a => a.id === app.id ? { ...a, status: 'Interview Scheduled', history: [...a.history, { status: 'Interview Scheduled', date: new Date().toISOString().slice(0, 10), note: 'Interview scheduled in demo mode' }] } : a) : demo.applications };
    updateDemo(updated); setModal(false); setNoticeFor('Interview added to the demo schedule.');
  };

  return <div className="page-enter">
    <div className="page-heading"><div><div className="eyebrow page-eyebrow"><span className="live-dot" /> {isAdmin ? 'PLACEMENT OFFICE' : isRecruiter ? 'RECRUITER WORKSPACE' : 'STUDENT WORKSPACE'} · DEMO</div><h1 className="display-font">{title}</h1><p>{headingDescription}</p></div><div className="heading-actions">{(route.kind === 'recruiter-jobs' || route.kind === 'drives') && <button className="button button-primary" onClick={() => setModal(true)} data-testid="button-create-job"><Plus size={16} /> Create job</button>}{route.kind === 'recruiter-applicants' && <button className="button button-secondary" onClick={() => setModal(true)} data-testid="button-schedule-interview"><CalendarDays size={16} /> Schedule interview</button>}</div></div>
    {notice && <div className="notice-toast" role="status" data-testid="status-demo-notice"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-notice"><X size={15} /></button></div>}
    {(route.kind === 'student-home' || route.kind === 'admin-home') && homeDashboard(route.kind === 'admin-home')}
    {route.kind === 'recruiter-home' && <><div className="metric-grid">{[{ label: 'Active postings', value: demo.jobs.filter(j => j.companyId === 'co-1' && j.status === 'Open').length, hint: 'Open roles', icon: BriefcaseBusiness }, { label: 'Applicants', value: allApps.length, hint: 'Across your postings', icon: Users }, { label: 'Shortlisted', value: allApps.filter(a => a.status === 'Shortlisted' || a.status === 'Interview Scheduled').length, hint: 'Moving forward', icon: Check }, { label: 'Interviews', value: demo.interviews.filter(i => allApps.some(a => a.id === i.applicationId)).length, hint: 'Scheduled conversations', icon: CalendarDays }].map((m, i) => { const Icon = m.icon; return <article key={m.label} className="metric-card"><span className={`metric-icon metric-icon-${i}`}><Icon size={18} /></span><span className="metric-label">{m.label}</span><b>{m.value}</b><small>{m.hint}</small></article>; })}</div><div className="section-row"><div className="section-title"><div><h2>Recent applicants</h2><p>Latest candidate activity across Northstar Systems roles.</p></div><Link href="/recruiter/applicants" className="subtle-link" data-testid="link-all-candidates">All candidates <ArrowRight size={15} /></Link></div>{appTable([...allApps].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5), true)}</div><div className="section-row"><div className="section-title"><div><h2>Your job postings</h2><p>Manage live opportunities in the campus cycle.</p></div><Link href="/recruiter/jobs" className="subtle-link" data-testid="link-all-postings">Manage jobs <ArrowRight size={15} /></Link></div>{jobList(jobs.slice(0, 3))}</div></>}

    {route.kind === 'jobs' && <><div className="callout"><span className="callout-icon"><ShieldAlert size={17} /></span><div><b>Eligibility review is not available in this demo.</b><small>Role requirements are shown for reference only. No job is represented as verified eligible or ineligible for your profile.</small></div></div>{tablePage('Search roles, skills, or companies', ['All', 'Engineering', 'Data', 'Analytics', 'Saved'])}<div className="job-filter-row"><label><span>Location</span><select value={jobLocation} onChange={e => { setJobLocation(e.target.value); setPage(1); }} data-testid="select-job-location"><option>All locations</option>{[...new Set(demo.jobs.filter(j => j.status === 'Open').map(j => j.location))].map(location => <option key={location}>{location}</option>)}</select></label><label><span>Course</span><select value={jobCourse} onChange={e => { setJobCourse(e.target.value); setPage(1); }} data-testid="select-job-course"><option>All courses</option>{[...new Set(demo.jobs.flatMap(j => j.courses))].map(course => <option key={course}>{course}</option>)}</select></label><label><span>Package</span><select value={packageBand} onChange={e => { setPackageBand(e.target.value); setPage(1); }} data-testid="select-package-band"><option>Any package</option><option>Under ₹10 LPA</option><option>₹10–12 LPA</option><option>Above ₹12 LPA</option></select></label><span>Graduation year · 2026 cohort</span></div><div className="result-caption">{listJobs.length} open roles · sorted by deadline</div>{jobList(rowsJobs)}{pagination(page, pagedJobs.pages)}</>}
    {route.kind === 'recruiter-jobs' && <>{tablePage('Search job title, location, or skill', ['All', 'Open', 'Draft', 'Closed'])}<div className="result-caption">{jobs.length} postings · only visible in this recruiter demo workspace</div>{jobList(rowsJobs)}{pagination(page, pagedJobs.pages)}</>}
    {route.kind === 'drives' && <><div className="callout"><span className="callout-icon"><CalendarDays size={17} /></span><div><b>Placement cycle · Spring 2026</b><small>Job postings below are the drive records for this demo. Create a job to add a role to the cycle.</small></div></div>{tablePage('Search company or role', ['All', 'Open', 'Draft', 'Closed'])}{jobList(rowsJobs)}{pagination(page, pagedJobs.pages)}</>}
    {route.kind === 'applications' && <>{tablePage('Search role, company, or status', ['All', ...statuses])}<div className="result-caption">{appRows.length} applications · status history is available on each record</div>{appTable(rowsApps)}{pagination(page, pagedApps.pages)}</>}
    {route.kind === 'recruiter-applicants' && <>{tablePage('Search candidate, role, or status', ['All', ...statuses])}<div className="callout"><span className="callout-icon"><ShieldAlert size={17} /></span><div><b>Candidate data is limited to this company’s demo records.</b><small>Role previews are not real access controls. Candidate data must be protected by backend authorization in production.</small></div></div>{appTable(rowsApps, true)}{pagination(page, pagedApps.pages)}</>}
    {route.kind === 'students' && <>{tablePage('Search name, student ID, course, or skill', ['All', 'B.Tech', 'M.Tech', 'BBA'])}<div className="filter-chips">{['All', 'Placed', 'Seeking'].map(item => <button type="button" key={item} onClick={() => { setPlacementFilter(item); setPage(1); }} className={`filter-chip ${placementFilter === item ? 'filter-chip-active' : ''}`} data-testid={`button-student-filter-${item.toLowerCase()}`}>{item}</button>)}<span>Profile completion and placement status are fixture attributes.</span></div>{studentTable(rowsStudents)}{pagination(page, pagedStudents.pages)}</>}
    {route.kind === 'companies' && <>{tablePage('Search company, recruiter, or industry') }<div className="table-wrap"><table><thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Recruiter</th><th>Open roles</th></tr></thead><tbody>{rowsCompanies.map(c => <tr key={c.id} data-testid={`row-company-${c.id}`}><td><span className="table-primary-link">{c.name}</span><small className="table-sub">{c.id}</small></td><td>{c.industry}</td><td>{c.location}</td><td>{c.recruiter}<small className="table-sub">{c.email}</small></td><td>{demo.jobs.filter(j => j.companyId === c.id && j.status === 'Open').length}</td></tr>)}</tbody></table>{rowsCompanies.length === 0 && <Empty title="No companies found" detail="Try another search." />}</div>{pagination(page, pagedCompanies.pages)}</>}
    {route.kind === 'interviews' && <><div className="callout"><span className="callout-icon"><CalendarDays size={17} /></span><div><b>{interviewRows.length} scheduled interview{interviewRows.length === 1 ? '' : 's'}</b><small>Dates and times are fixture details for this demo cycle. Recruiter previews may add schedules.</small></div></div>{isRecruiter && <div className="table-tools"><button className="button button-primary" onClick={() => setModal(true)} data-testid="button-schedule-interview"><Plus size={16} /> Schedule interview</button></div>}{interviewTable}</>}
    {route.kind === 'job-detail' && selectedJob && <><Link href="/student/jobs" className="back-link in-page" data-testid="link-back-jobs"><ArrowLeft size={16} /> Back to open roles</Link><div className="detail-layout"><div className="detail-main"><section className="panel job-detail-panel"><div className="detail-company"><span className="company-mark large">{companiesById[selectedJob.companyId]?.name.slice(0,1)}</span><div><p>{companiesById[selectedJob.companyId]?.name} · {selectedJob.location}</p><h2>{selectedJob.title}</h2></div></div><div className="job-detail-facts"><span><b>₹{selectedJob.package} LPA</b> package</span><span><b>{selectedJob.category}</b> category</span><span><b>{prettyDate(selectedJob.deadline)}</b> deadline</span></div><h3>About the role</h3><p>{selectedJob.description}</p><h3>Skills and qualifications</h3><div className="skill-list">{selectedJob.skills.map(skill => <span key={skill}>{skill}</span>)}</div><h3>Eligibility criteria</h3><p>Listed requirements from the job posting. PlaceMate has no server eligibility response in this demo, so this is not a verified checklist.</p><ul className="requirements"><li>Courses listed: {selectedJob.courses.join(', ')}</li><li>Graduation year: {selectedJob.year}</li><li>Minimum CGPA listed: {selectedJob.minCgpa.toFixed(1)}</li></ul></section></div><aside className="detail-aside"><section className="panel apply-panel"><span className="panel-kicker">APPLICATION</span><h3>Interested in this role?</h3><p>Your application will be recorded in this browser’s demo data only.</p><div className="eligibility-warning"><ShieldAlert size={17} /><span>Eligibility review not available yet.</span></div><button className="button button-primary button-wide" disabled={selectedJob.status !== 'Open' || demo.applications.some(a => a.studentId === student.id && a.jobId === selectedJob.id)} onClick={() => applyFor(selectedJob)} data-testid="button-detail-apply">{selectedJob.status !== 'Open' ? 'Applications closed' : demo.applications.some(a => a.studentId === student.id && a.jobId === selectedJob.id) ? 'Already applied' : 'Apply in demo'}</button><button className="button button-outline button-wide" onClick={() => toggleSaved(selectedJob.id)} data-testid="button-detail-save">{demo.savedJobs.includes(selectedJob.id) ? 'Remove from saved' : 'Save this role'}</button></section></aside></div></>}
    {route.kind === 'job-detail' && !selectedJob && <Empty title="Role not found" detail="This job may have been removed from the demo workspace." link="/student/jobs" linkText="Browse open roles" />}
    {route.kind === 'application-detail' && <ApplicationDetail app={selectedApp} demo={demo} companiesById={companiesById} />}
    {route.kind === 'profile' && <><div className="profile-hero panel"><span className="avatar avatar-large avatar-blue">AM</span><div><span className="status status-selected">Student profile</span><h2>{student.name}</h2><p>{student.course} · {student.department} · Class of {student.year}</p><span className="subtle-text">This fixture profile is visible in the student demo workspace.</span></div><button className="button button-outline" onClick={() => setModal(true)} data-testid="button-edit-profile">Edit demo profile</button></div><div className="detail-layout profile-columns"><div className="panel detail-panel"><h2>Academic details</h2><DetailRow label="Student ID" value={student.id} /><DetailRow label="Email" value={student.email} /><DetailRow label="CGPA" value={student.cgpa.toFixed(1)} /><DetailRow label="Graduation year" value={String(student.year)} /><DetailRow label="Profile completeness" value={`${student.completion}%`} /><h3>Skills</h3><div className="skill-list">{student.skills.map(s => <span key={s}>{s}</span>)}</div></div><div className="panel detail-panel"><h2>Career interests</h2><div className="skill-list">{student.interests.map(s => <span key={s}>{s}</span>)}</div><div className="callout compact-callout"><ShieldAlert size={17} /><span>Changes in this screen update this browser’s demo fixture only.</span></div></div></div></>}
    {route.kind === 'profile' && modal && <Modal title="Edit demo profile" close={() => setModal(false)}><form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateDemo({ ...demo, students: demo.students.map(s => s.id === student.id ? { ...s, name: String(fd.get('name')), email: String(fd.get('email')), skills: String(fd.get('skills')).split(',').map(x => x.trim()).filter(Boolean), completion: Math.min(100, s.completion + 3) } : s) }); setModal(false); setNoticeFor('Demo profile updated.'); }}><Field label="Full name" name="name" value={student.name} /><Field label="Email address" name="email" value={student.email} type="email" /><Field label="Skills (comma-separated)" name="skills" value={student.skills.join(', ')} /><ModalActions close={() => setModal(false)} /></form></Modal>}
    {route.kind === 'resume' && <div className="resume-state panel"><span className="empty-icon"><FileText size={25} /></span><p className="eyebrow">RESUME FEEDBACK</p><h2>Review not available yet</h2><p>No real resume review has been generated for this profile. PlaceMate will not display a fabricated score or claim a resume was analyzed.</p><div className="resume-explain"><b>What this area will contain</b><span>Structured feedback on readability, skills, experience, education, and achievements when a secure review service is connected.</span></div><button className="button button-outline" onClick={() => setLocation('/student/career-guide')} data-testid="button-open-career-guide">Explore the career guide <ArrowRight size={15} /></button></div>}
    {route.kind === 'career-guide' && <><div className="callout"><span className="callout-icon"><Sparkles size={18} /></span><div><b>Preparation guidance, not a placement prediction.</b><small>Suggestions are general and do not represent a resume analysis or guarantee of selection.</small></div></div><div className="guide-grid">{[{ n: '01', title: 'Make project outcomes concrete', copy: 'Describe the problem, your contribution, and the observable result. Use scope or impact where you have evidence.', tag: 'Profile' }, { n: '02', title: 'Practice explaining trade-offs', copy: 'Walk through one technical decision from a project: what alternatives you considered and why you chose your approach.', tag: 'Interview readiness' }, { n: '03', title: 'Tailor the evidence you share', copy: 'Review each job’s listed skills and make relevant coursework, projects, and experience easy to find.', tag: 'Applications' }, { n: '04', title: 'Keep a steady application log', copy: 'Use your tracker to record the next action after each conversation and follow up at an appropriate time.', tag: 'Organization' }].map(x => <article className="guide-item" key={x.n}><span className="guide-number">{x.n}</span><div><span className="guide-tag">{x.tag}</span><h2>{x.title}</h2><p>{x.copy}</p></div><ArrowRight size={17} /></article>)}</div></>}
    {route.kind === 'notifications' && <div className="notification-list">{demo.notifications.map(n => <article className={`notification-item ${n.read ? '' : 'notification-unread'}`} key={n.id} data-testid={`notification-${n.id}`}><span className="notification-icon"><Bell size={17} /></span><div><b>{n.title}</b><p>{n.body}</p><small>{prettyDate(n.date)}</small></div>{!n.read && <span className="unread-mark" aria-label="Unread" />}</article>)}<button className="button button-outline" onClick={() => updateDemo({ ...demo, notifications: demo.notifications.map(n => ({ ...n, read: true })) })} data-testid="button-mark-read">Mark all as read</button></div>}
    {route.kind === 'company' && <><div className="profile-hero panel"><span className="company-mark large">N</span><div><span className="status status-selected">Recruiter demo profile</span><h2>Northstar Systems</h2><p>Enterprise software · Bengaluru</p><span className="subtle-text">Company details are fixture information and visible in recruiter workspace preview.</span></div><button className="button button-outline" onClick={() => setModal(true)} data-testid="button-edit-company">Edit profile</button></div><div className="panel detail-panel company-details"><h2>Recruiter contact</h2><DetailRow label="Contact" value="Leena Rao" /><DetailRow label="Email" value="leena@northstarsystems.example" /><DetailRow label="Industry" value="Enterprise software" /><DetailRow label="Location" value="Bengaluru" /><DetailRow label="Open roles" value={String(demo.jobs.filter(j => j.companyId === 'co-1' && j.status === 'Open').length)} /></div>{modal && <Modal title="Edit company profile" close={() => setModal(false)}><form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateDemo({ ...demo, companies: demo.companies.map(c => c.id === 'co-1' ? { ...c, name: String(fd.get('name')), recruiter: String(fd.get('recruiter')), location: String(fd.get('location')) } : c) }); setModal(false); setNoticeFor('Demo company profile updated.'); }}><Field label="Company name" name="name" value={companiesById['co-1']?.name} /><Field label="Recruiter contact" name="recruiter" value={companiesById['co-1']?.recruiter} /><Field label="Location" name="location" value={companiesById['co-1']?.location} /><ModalActions close={() => setModal(false)} /></form></Modal>}</>}
    {route.kind === 'job-form' && <JobEditor id={id} />}
    {route.kind === 'analytics' && <Analytics adminView={isAdmin} demo={demo} />}
    {route.kind === 'classification' && <Classification demo={demo} query={query} setQuery={setQuery} />}
    {route.kind === 'student-detail' && <StudentDetail student={selectedStudent} demo={demo} companiesById={companiesById} />}
    {route.kind === 'applicant-detail' && <ApplicantDetail student={demo.students.find(s => s.id === id)} demo={demo} companiesById={companiesById} onStatus={updateStatus} />}
    {route.kind === 'settings' && <div className="settings-grid"><section className="panel detail-panel"><span className="settings-icon"><ShieldAlert size={19} /></span><h2>Workspace mode</h2><p>Demo is isolated from the API. API mode displays no records until the backend contract is agreed.</p><div className="settings-mode"><span className="mode-dot" /> Demo data active</div><button className="button button-outline" onClick={() => setModal(true)} data-testid="button-reset-demo">Reset demo data</button></section><section className="panel detail-panel"><span className="settings-icon"><Users size={19} /></span><h2>Role previews</h2><p>Switch workspace from the sidebar to explore each view. Browser role checks are a navigation convenience, not security.</p><div className="role-note">Production authorization must be enforced by the backend.</div></section><section className="panel detail-panel"><span className="settings-icon"><FileText size={19} /></span><h2>Data clarity</h2><p>Metrics reflect locally stored fictional fixtures. Editing or resetting affects only this browser profile.</p><span className="status status-blue">Synthetic fixture · 2026 cycle</span></section>{modal && <Modal title="Reset demo workspace?" close={() => setModal(false)}><p className="modal-copy">This restores the original fictional cohort, jobs, applications, and interviews in this browser.</p><ModalActions close={() => setModal(false)} submitLabel="Reset demo data" submit={() => { const fresh = resetDemo(); updateDemo(fresh); setModal(false); setNoticeFor('Demo data has been reset.'); }} /></Modal>}</div>}
    {(route.kind === 'recruiter-jobs' || route.kind === 'drives') && modal && <Modal title="Create a job posting" close={() => setModal(false)}><form onSubmit={onJobSubmit}><Field label="Job title" name="title" placeholder="e.g. Software Engineer" required /><Field label="Location" name="location" placeholder="Bengaluru or Remote" required /><div className="form-row"><Field label="Category" name="category" placeholder="Engineering" required /><Field label="Package (LPA)" name="package" type="number" placeholder="12" required /></div><div className="form-row"><Field label="Application deadline" name="deadline" type="date" required /><Field label="Minimum CGPA listed" name="cgpa" type="number" step="0.1" placeholder="7.0" required /></div><Field label="Skills (comma-separated)" name="skills" placeholder="React, SQL" required /><label className="field-label" htmlFor="job-description">Role description</label><textarea id="job-description" name="description" className="input textarea" required data-testid="input-job-description" /><ModalActions close={() => setModal(false)} /></form></Modal>}
    {(route.kind === 'recruiter-applicants' || (route.kind === 'interviews' && isRecruiter)) && modal && <Modal title="Schedule an interview" close={() => setModal(false)}><form onSubmit={onInterviewSubmit}><label className="field-label" htmlFor="interview-application">Candidate application</label><select id="interview-application" className="input" name="application" required data-testid="select-interview-application">{allApps.map(a => <option key={a.id} value={a.id}>{demo.students.find(s => s.id === a.studentId)?.name} · {demo.jobs.find(j => j.id === a.jobId)?.title}</option>)}</select><div className="form-row"><Field label="Date" name="date" type="date" required /><Field label="Time" name="time" type="time" required /></div><Field label="Interview type" name="type" placeholder="Technical interview" required /><Field label="Location or meeting room" name="location" placeholder="Video room / office" required /><ModalActions close={() => setModal(false)} /></form></Modal>}
  </div>;
}

function ApplicationDetail({ app, demo, companiesById }: { app?: Application; demo: DemoState; companiesById: Record<string, Company> }) {
  if (!app) return <Empty title="Application not found" detail="This record may not belong to your demo profile." link="/student/applications" linkText="Return to applications" />;
  const job = demo.jobs.find(j => j.id === app.jobId); const company = companiesById[job?.companyId || '']; const interview = demo.interviews.find(i => i.applicationId === app.id);
  return <><Link href="/student/applications" className="back-link in-page" data-testid="link-back-applications"><ArrowLeft size={16} /> Back to applications</Link><div className="detail-layout"><div className="detail-main"><section className="panel application-summary"><div><p className="eyebrow">APPLICATION RECORD · {app.id}</p><h2>{job?.title || 'Role unavailable'}</h2><p>{company?.name} · {job?.location}</p></div>{statusBadge(app.status)}</section><section className="panel detail-panel history-panel"><div className="panel-heading"><div><h2>Status history</h2><p>Recorded changes for this application.</p></div></div><div className="timeline">{[...app.history].reverse().map((entry, index) => <div className={`timeline-entry ${index === 0 ? 'timeline-current' : ''}`} key={`${entry.status}-${entry.date}-${index}`}><span className="timeline-dot" /><div><b>{entry.status}</b><small>{prettyDate(entry.date)}</small><p>{entry.note}</p></div></div>)}</div></section></div><aside className="detail-aside"><section className="panel detail-panel"><span className="panel-kicker">NEXT STEP</span><h3>{app.status === 'Interview Scheduled' ? 'Prepare for your conversation' : app.status === 'Waiting for Result' ? 'Decision pending' : app.status === 'Selected' ? 'Review your offer details' : app.status === 'Rejected' ? 'Keep your search moving' : 'Stay close to your inbox'}</h3><p>{interview ? `${interview.type} · ${prettyDate(interview.date)} at ${interview.time}` : 'Check your notifications for updates from the placement team.'}</p>{interview && <div className="interview-detail"><CalendarDays size={16} />{interview.location}</div>}</section><div className="callout compact-callout"><ShieldAlert size={16} /><span>Application updates shown are fictional demo records.</span></div></aside></div></>;
}

function JobEditor({ id }: { id: string }) {
  const { demo, updateDemo } = usePM(); const [, setLocation] = useLocation(); const existing = demo.jobs.find(j => j.id === id);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const fd = new FormData(event.currentTarget);
    if (existing) updateDemo({ ...demo, jobs: demo.jobs.map(j => j.id === existing.id ? { ...j, title: String(fd.get('title')), location: String(fd.get('location')), package: Number(fd.get('package')), deadline: String(fd.get('deadline')), skills: String(fd.get('skills')).split(',').map(x => x.trim()).filter(Boolean), description: String(fd.get('description')) } : j) });
    else { const job: Job = { id: `job-${Date.now()}`, title: String(fd.get('title')), companyId: 'co-1', location: String(fd.get('location')), category: String(fd.get('category')), package: Number(fd.get('package')), deadline: String(fd.get('deadline')), year: 2026, minCgpa: Number(fd.get('cgpa')), courses: ['B.Tech', 'M.Tech'], skills: String(fd.get('skills')).split(',').map(x => x.trim()).filter(Boolean), description: String(fd.get('description')), status: 'Open' }; updateDemo({ ...demo, jobs: [job, ...demo.jobs] }); }
    setLocation('/recruiter/jobs');
  };
  return <div className="form-page panel"><Link href="/recruiter/jobs" className="back-link" data-testid="link-back-recruiter-jobs"><ArrowLeft size={16} /> Back to jobs</Link><p className="eyebrow">{existing ? 'POSTING DETAILS' : 'NEW OPPORTUNITY'} · DEMO</p><h2>{existing ? `Edit ${existing.title}` : 'Create a job posting'}</h2><p>Changes are saved locally in the recruiter demo workspace.</p><form onSubmit={submit}><Field label="Job title" name="title" value={existing?.title} required /><div className="form-row"><Field label="Location" name="location" value={existing?.location} required /><Field label="Category" name="category" value={existing?.category} required /></div><div className="form-row"><Field label="Package (LPA)" name="package" type="number" value={existing?.package} required /><Field label="Minimum CGPA listed" name="cgpa" type="number" step="0.1" value={existing?.minCgpa} required /></div><Field label="Application deadline" name="deadline" type="date" value={existing?.deadline} required /><Field label="Required skills (comma-separated)" name="skills" value={existing?.skills.join(', ')} required /><label className="field-label" htmlFor="editor-description">Role description</label><textarea id="editor-description" className="input textarea" name="description" defaultValue={existing?.description || ''} required data-testid="input-role-description" /><div className="form-actions"><button type="submit" className="button button-primary" data-testid="button-save-job"><Check size={16} /> Save posting</button><Link href="/recruiter/jobs" className="button button-outline" data-testid="link-cancel-job">Cancel</Link></div></form></div>;
}

function StudentDetail({ student, demo, companiesById }: { student?: Student; demo: DemoState; companiesById: Record<string, Company> }) {
  if (!student) return <Empty title="Student record not found" detail="Choose a student from the directory." link="/admin/students" linkText="Return to directory" />;
  const apps = demo.applications.filter(a => a.studentId === student.id);
  return <><Link href="/admin/students" className="back-link in-page" data-testid="link-back-students"><ArrowLeft size={16} /> Back to student directory</Link><div className="profile-hero panel"><span className="avatar avatar-large avatar-blue">{initials(student.name)}</span><div><span className={student.placed ? 'status status-selected' : 'status status-muted'}>{student.placed ? 'Placed in demo records' : 'Seeking placement'}</span><h2>{student.name}</h2><p>{student.id} · {student.course} · {student.department}</p></div><div className="profile-hero-stat"><b>{student.cgpa.toFixed(1)}</b><small>CGPA</small></div></div><div className="metric-grid compact-metrics">{[{ label: 'Applications', value: apps.length }, { label: 'Under review', value: apps.filter(a => a.status === 'Under Review').length }, { label: 'Shortlists', value: apps.filter(a => a.status === 'Shortlisted' || a.status === 'Interview Scheduled').length }, { label: 'Selections', value: apps.filter(a => a.status === 'Selected').length }].map(m => <div className="mini-metric" key={m.label}><small>{m.label}</small><b>{m.value}</b></div>)}</div><div className="detail-layout profile-columns"><section className="panel detail-panel"><h2>Academic & career profile</h2><DetailRow label="Email" value={student.email} /><DetailRow label="Graduation year" value={String(student.year)} /><DetailRow label="Profile completion" value={`${student.completion}%`} /><h3>Skills</h3><div className="skill-list">{student.skills.map(s => <span key={s}>{s}</span>)}</div><h3>Interests</h3><div className="skill-list">{student.interests.map(s => <span key={s}>{s}</span>)}</div></section><section className="panel detail-panel"><h2>Placement history</h2><p className="subtle-text">Application history from shared demo fixtures.</p><div className="student-app-history">{apps.map(app => { const job = demo.jobs.find(j => j.id === app.jobId); return <div key={app.id}><span className="history-marker" /><div><b>{job?.title}</b><small>{companiesById[job?.companyId || '']?.name} · {prettyDate(app.date)}</small>{statusBadge(app.status)}</div></div>; })}{apps.length === 0 && <Empty title="No application history" detail="No demo applications are linked to this student." />}</div><div className="callout compact-callout"><ShieldAlert size={16} /><span>Resume review is not available; no feedback is shown.</span></div></section></div></>;
}

function ApplicantDetail({ student, demo, companiesById, onStatus }: { student?: Student; demo: DemoState; companiesById: Record<string, Company>; onStatus: (id: string, status: AppStatus) => void }) {
  const [, setLocation] = useLocation();
  if (!student) return <Empty title="Candidate not found" detail="Return to the candidate list." link="/recruiter/applicants" linkText="All applicants" />;
  const apps = demo.applications.filter(a => a.studentId === student.id && demo.jobs.some(j => j.id === a.jobId && j.companyId === 'co-1'));
  return <><Link href="/recruiter/applicants" className="back-link in-page" data-testid="link-back-applicants"><ArrowLeft size={16} /> Back to candidates</Link><div className="profile-hero panel"><span className="avatar avatar-large avatar-blue">{initials(student.name)}</span><div><span className="status status-blue">Candidate · Demo record</span><h2>{student.name}</h2><p>{student.course} · {student.department} · Class of {student.year}</p><span className="subtle-text">Candidate view limited to fields included in this demo fixture.</span></div></div><div className="detail-layout profile-columns"><section className="panel detail-panel"><h2>Candidate snapshot</h2><DetailRow label="Student ID" value={student.id} /><DetailRow label="CGPA" value={student.cgpa.toFixed(1)} /><DetailRow label="Skills" value={student.skills.join(', ')} /><DetailRow label="Career interests" value={student.interests.join(', ')} /><div className="callout compact-callout"><ShieldAlert size={16} /><span>Eligibility status is not available from a server and is not inferred here.</span></div><div className="resume-explain"><b>Resume review</b><span>Review not available yet.</span></div></section><section className="panel detail-panel"><h2>Applications to Northstar Systems</h2>{apps.map(app => { const job = demo.jobs.find(j => j.id === app.jobId); return <div className="candidate-application" key={app.id}><div><b>{job?.title}</b><small>{companiesById[job?.companyId || '']?.name} · {prettyDate(app.date)}</small>{statusBadge(app.status)}</div><label className="field-label" htmlFor={`status-${app.id}`}>Update demo status</label><select id={`status-${app.id}`} className="compact-select status-select" value={app.status} onChange={e => onStatus(app.id, e.target.value as AppStatus)} data-testid={`select-status-${app.id}`}>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>; })}{!apps.length && <Empty title="No company applications" detail="This candidate has no application for an active company role." />}<button className="button button-outline" onClick={() => setLocation('/recruiter/interviews')} data-testid="button-view-interviews"><CalendarDays size={16} /> View interview schedule</button></section></div></>;
}

function Classification({ demo, query, setQuery }: { demo: DemoState; query: string; setQuery: (value: string) => void }) {
  const [jobId, setJobId] = useState(demo.jobs[0]?.id || '');
  const [segmentName, setSegmentName] = useState('');
  const [savedSegments, setSavedSegments] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('placemate-segments') || '[]') as string[]; } catch { return []; } });
  const job = demo.jobs.find(j => j.id === jobId);
  const filtered = demo.students.filter(s => `${s.name} ${s.id} ${s.skills.join(' ')} ${s.department}`.toLowerCase().includes(query.toLowerCase()));
  const saveSegment = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const next = [...savedSegments, `${segmentName.trim()} · ${job?.title || 'All students'}`]; setSavedSegments(next); localStorage.setItem('placemate-segments', JSON.stringify(next)); setSegmentName(''); };
  return <><div className="callout"><span className="callout-icon"><ShieldAlert size={17} /></span><div><b>Criteria preview · demo only</b><small>Comparisons below are calculated from fictional fixture fields for exploration. They are not eligibility decisions, verified outcomes, or backend responses.</small></div></div><div className="classification-controls"><div><label className="field-label" htmlFor="classification-job">Selected role</label><select id="classification-job" className="input" value={jobId} onChange={e => setJobId(e.target.value)} data-testid="select-classification-job">{demo.jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {demo.companies.find(c => c.id === j.companyId)?.name}</option>)}</select></div><label className="search-box classification-search"><Search size={17} /><input aria-label="Search students" placeholder="Find a student or skill" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-classification-search" /></label></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>CGPA field</th><th>Course field</th><th>Skills in profile</th><th>Criteria preview</th></tr></thead><tbody>{filtered.map(s => { const checks = job ? [s.cgpa >= job.minCgpa, job.courses.includes(s.course), job.year === s.year] : []; const met = checks.filter(Boolean).length; return <tr key={s.id}><td><Link className="table-primary-link" href={`/admin/students/${s.id}`} data-testid={`link-classify-${s.id}`}>{s.name}</Link><small className="table-sub">{s.id}</small></td><td>{s.cgpa.toFixed(1)} / {job?.minCgpa.toFixed(1)} min</td><td>{s.course} / {job?.courses.join(', ')}</td><td>{job?.skills.filter(skill => s.skills.some(x => x.toLowerCase() === skill.toLowerCase())).join(', ') || 'No listed skill overlap'}</td><td><span className={`status ${met === checks.length ? 'status-selected' : 'status-under-review'}`}>{met}/{checks.length} criteria fields match*</span></td></tr>; })}</tbody></table>{!filtered.length && <Empty title="No students match" detail="Try another search term." />}</div><p className="definition-note">* Simple comparisons against demo fixture values only. No decision or application access is granted.</p><section className="panel segment-panel"><div><p className="eyebrow">SAVED SEGMENTS · LOCAL DEMO</p><h2>Save this inspection set</h2><p>Save a named label for this current role and filter context. It stays in this browser only.</p></div><form onSubmit={saveSegment}><label className="sr-only" htmlFor="segment-name">Segment name</label><input id="segment-name" className="input" placeholder="e.g. Data roles · spring 2026" value={segmentName} onChange={e => setSegmentName(e.target.value)} required data-testid="input-segment-name" /><button className="button button-primary" type="submit" data-testid="button-save-segment">Save segment</button></form>{savedSegments.map((s, i) => <div className="saved-segment" key={`${s}-${i}`}><span>{s}</span><button className="text-action" onClick={() => { const next = savedSegments.filter((_, ix) => ix !== i); setSavedSegments(next); localStorage.setItem('placemate-segments', JSON.stringify(next)); }} data-testid={`button-delete-segment-${i}`}>Remove</button></div>)}</section></>;
}

function Analytics({ adminView, demo }: { adminView: boolean; demo: DemoState }) {
  const relevantJobs = demo.jobs.filter(j => adminView || j.companyId === 'co-1');
  const relevantApps = demo.applications.filter(a => relevantJobs.some(j => j.id === a.jobId));
  const placed = adminView ? demo.students.filter(s => s.placed).length : new Set(relevantApps.filter(a => a.status === 'Selected').map(a => a.studentId)).size;
  const denominator = adminView ? demo.students.length : relevantApps.length;
  const placedRate = denominator ? (placed / denominator) * 100 : 0;
  const statusData = statuses.map(s => ({ name: s, value: relevantApps.filter(a => a.status === s).length })).filter(x => x.value);
  const courses = [...new Set(demo.students.map(s => s.course))].map(course => { const cohort = demo.students.filter(s => s.course === course); return { name: course, total: cohort.length, placed: cohort.filter(s => s.placed).length }; });
  const companies = demo.companies.filter(company => adminView || company.id === 'co-1').map(company => ({ name: company.name, applications: relevantApps.filter(a => demo.jobs.some(j => j.id === a.jobId && j.companyId === company.id)).length, selected: relevantApps.filter(a => a.status === 'Selected' && demo.jobs.some(j => j.id === a.jobId && j.companyId === company.id)).length }));
  const visibleStudents = adminView ? demo.students.length : new Set(relevantApps.map(a => a.studentId)).size;
  return <><div className="callout"><span className="callout-icon"><Activity size={17} /></span><div><b>All values below are derived from shared fictional records.</b><small>{adminView ? 'Placement rate means unique students with a Selected application divided by all students in this demo cohort.' : 'Hiring metrics are limited to Northstar Systems postings in this recruiter preview.'}</small></div></div><div className="metric-grid">{[{ label: adminView ? 'Students' : 'Candidate pool', value: visibleStudents }, { label: adminView ? 'Companies' : 'Open roles', value: adminView ? demo.companies.length : relevantJobs.filter(j => j.status === 'Open').length }, { label: adminView ? 'Open roles' : 'Shortlisted', value: adminView ? relevantJobs.filter(j => j.status === 'Open').length : relevantApps.filter(a => ['Shortlisted', 'Interview Scheduled'].includes(a.status)).length }, { label: 'Applications', value: relevantApps.length }].map((x, i) => <div className="metric-card compact-stat" key={x.label}><span className={`metric-icon metric-icon-${i}`}><ChartNoAxesCombined size={18} /></span><span className="metric-label">{x.label}</span><b>{x.value}</b><small>Shared demo dataset</small></div>)}</div><div className="dashboard-grid"><section className="panel analytics-panel"><div className="panel-heading"><div><h2>Application status distribution</h2><p>{relevantApps.length} total application records</p></div></div><div className="analytic-bars">{statusData.map((s, i) => <div className="analytic-bar-row" key={s.name}><span>{s.name}</span><div><i style={{ width: `${Math.max(4, (s.value / Math.max(...statusData.map(d => d.value), 1)) * 100)}%`, background: ['#4659bb', '#7381d0', '#2c9474', '#dc9c4a', '#789eb8', '#319876', '#c66b73', '#9aa5b6'][i] }} /></div><b>{s.value}</b></div>)}</div></section><section className="panel analytics-panel placement-rate"><p className="eyebrow">{adminView ? 'UNIQUE STUDENTS PLACED' : 'SELECTED APPLICATION RATE'}</p><div className="rate-number">{placedRate.toFixed(1)}<span>%</span></div><p>{adminView ? `${placed} placed out of ${demo.students.length} students in the cohort.` : `${placed} selected outcomes out of ${relevantApps.length} company applications.`}</p><div className="definition-note">{adminView ? 'Selected application ÷ distinct students in this fixture. This is a demo-derived measure, not a live institutional rate.' : 'Selected Northstar applications ÷ Northstar applications in the fixture.'}</div></section></div><div className="dashboard-grid">{adminView && <section className="panel analytics-panel"><div className="panel-heading"><div><h2>Course-wise placement</h2><p>Unique placed students in each course fixture.</p></div></div><div className="course-performance">{courses.map(c => <div key={c.name}><span>{c.name}</span><div><i style={{ width: `${c.total ? (c.placed / c.total) * 100 : 0}%` }} /></div><b>{c.placed} / {c.total}</b></div>)}</div></section>}<section className="panel analytics-panel"><div className="panel-heading"><div><h2>{adminView ? 'Company hiring outcomes' : 'Northstar hiring outcomes'}</h2><p>Application records and selected outcomes by company.</p></div></div><div className="company-outcomes">{companies.map(c => <div key={c.name}><span className="company-mark">{c.name.slice(0,1)}</span><b>{c.name}</b><small>{c.applications} applications</small><span className="status status-selected">{c.selected} selected</span></div>)}</div></section></div></>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" type="button" aria-label="Close dialog" onClick={close} data-testid="button-close-modal"><X size={18} /></button></div>{children}</section></div>;
}
function Field({ label, name, value, type = 'text', placeholder, required = false, step }: { label: string; name: string; value?: string | number; type?: string; placeholder?: string; required?: boolean; step?: string }) {
  const id = `field-${name}`;
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label><input className="input" id={id} name={name} type={type} defaultValue={value} placeholder={placeholder} required={required} step={step} data-testid={`input-${name}`} /></div>;
}
function ModalActions({ close, submitLabel = 'Save changes', submit }: { close: () => void; submitLabel?: string; submit?: () => void }) {
  return <div className="modal-actions"><button type="button" className="button button-outline" onClick={close} data-testid="button-cancel-modal">Cancel</button>{submit ? <button type="button" className="button button-primary" onClick={submit} data-testid="button-confirm-modal">{submitLabel}</button> : <button type="submit" className="button button-primary" data-testid="button-submit-modal">{submitLabel}</button>}</div>;
}
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><b>{value}</b></div>; }
function statusBadge(value: AppStatus | string) { return <span className={`status status-${value.toLowerCase().replaceAll(' ', '-')}`} data-testid={`status-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>; }
function Empty({ title, detail, link, linkText }: { title: string; detail: string; link?: string; linkText?: string }) {
  return <div className="empty-state"><span className="empty-icon"><CircleHelp size={22} /></span><b>{title}</b><p>{detail}</p>{link && <Link href={link} className="text-action" data-testid="link-empty-action">{linkText || 'Continue'} <ArrowRight size={15} /></Link>}</div>;
}
function initials(name: string) { return name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(); }
function isUpcoming(value: string) { return value >= new Date().toISOString().slice(0, 10); }
function prettyDate(value: string) { if (!value) return 'Not set'; return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default App;
