import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export type BusinessStats = {
  jobsActive: number;
  projectsActive: number;
  channelsActive: number;
  businessesListed: number;
};

export async function fetchBusinessStats(): Promise<BusinessStats> {
  return apiFetch<BusinessStats>('business/stats', { method: 'GET' });
}

export type BusinessJobRow = {
  id: string;
  networkId: string;
  title: string;
  companyName: string;
  city: string | null;
  remote: boolean;
  jobType: string;
  salaryText: string | null;
  description: string;
  skills: unknown;
  contactMethod: string;
  contactValue: string | null;
  expiresAt: string | null;
  createdAt: string;
  owner: { id: string; name: string; avatar: string | null };
};

export async function fetchBusinessJobs(networkId: string, q?: Record<string, string>): Promise<{ data: BusinessJobRow[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  const params = new URLSearchParams({ networkId, ...q });
  return apiFetch<{ data: BusinessJobRow[] }>(`business/jobs?${params.toString()}`, { method: 'GET', token });
}

export async function fetchBusinessJob(jobId: string): Promise<BusinessJobRow & { network: { id: string; name: string } }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`business/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', token });
}

export type BusinessProjectRow = {
  id: string;
  networkId: string;
  title: string;
  description: string | null;
  status: string;
  teamSize: number | null;
  dueAt: string | null;
  owner: { id: string; name: string; avatar: string | null };
  _count?: { tasks: number };
};

export async function fetchBusinessProjects(
  networkId: string,
  q?: Record<string, string>,
): Promise<{ data: BusinessProjectRow[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  const params = new URLSearchParams({ networkId, ...q });
  return apiFetch<{ data: BusinessProjectRow[] }>(`business/projects?${params.toString()}`, { method: 'GET', token });
}

export async function fetchBusinessProject(projectId: string): Promise<{
  id: string;
  networkId: string;
  title: string;
  description: string | null;
  status: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee: { id: string; name: string; avatar: string | null } | null;
  }>;
  owner: { id: string; name: string; avatar: string | null };
  network: { id: string; name: string };
}> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`business/projects/${encodeURIComponent(projectId)}`, { method: 'GET', token });
}

export type DirectoryRow = {
  id: string;
  businessName: string;
  category: string;
  city: string | null;
  description: string | null;
  imageMedia: { id: string; url: string; mimeType: string } | null;
};

export async function fetchBusinessDirectory(networkId: string, q?: Record<string, string>): Promise<{ data: DirectoryRow[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  const params = new URLSearchParams({ networkId, ...q });
  return apiFetch<{ data: DirectoryRow[] }>(`business/directory?${params.toString()}`, { method: 'GET', token });
}

export async function fetchMyBusinessCommunities(networkId: string): Promise<{
  network: { id: string; name: string } | null;
  groups: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
}> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`business/my-communities?networkId=${encodeURIComponent(networkId)}`, { method: 'GET', token });
}
