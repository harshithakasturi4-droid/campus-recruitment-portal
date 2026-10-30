const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export type ApiStudent = {
  id: string;
  email: string;
  role: 'student';
  studentNumber: string;
  fullName: string;
  course: string;
  department: string;
  graduationYear: number;
  cgpa: string;
  skills: string[];
  interests: string[];
};

export type ApiJob = {
  id: string;
  title: string;
  companyId: string;
  company: string;
  location: string;
  category: string;
  package: number;
  deadline: string;
  year: number;
  minCgpa: number;
  courses: string[];
  skills: string[];
  optionalSkills: string[];
  description: string;
  status: 'Open' | 'Draft' | 'Closed';
};

export type ApiApplication = {
  id: string;
  studentId: string;
  jobId: string;
  date: string;
  status: AppStatus;
  jobTitle: string;
  company: string;
  history: { status: AppStatus; date: string; note: string | null }[];
};

import type { AppStatus } from './demo';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (csrfToken && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    headers.set('x-csrf-token', csrfToken);
  }

  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
