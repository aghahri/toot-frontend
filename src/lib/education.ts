import { apiFetch } from '@/lib/api';

export type EducationMeetingMini = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  durationMinutes?: number;
  educationLabel?: string | null;
};

export type EducationCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  ownerId: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  status: 'DRAFT' | 'PUBLISHED';
  channelId: string | null;
  groupId: string | null;
  nextMeetingId: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; avatar: string | null; username: string };
  nextMeeting: EducationMeetingMini | null;
  channel: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
  _count: { enrollments: number };
  me?: { id: string; role: 'STUDENT' | 'ASSISTANT' } | null;
  enrollments?: Array<{ id: string; role: 'STUDENT' | 'ASSISTANT' }>;
  _meta?: { isOwner: boolean };
};

export type EducationHub = {
  myCourses: EducationCourse[];
  upcomingMeetings: EducationMeetingMini[];
  publicCourses: EducationCourse[];
  teacherChannels: Array<{ id: string; name: string; description: string | null; networkId: string }>;
  studyGroups: Array<{ id: string; name: string; description: string | null; networkId: string | null }>;
};

export type EducationMyCourse = Pick<
  EducationCourse,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'coverImageUrl'
  | 'channel'
  | 'group'
  | 'nextMeeting'
  | 'owner'
>;

export type EducationMyUpcomingMeeting = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  course: {
    id: string;
    title: string;
  };
};

export type EducationMyDashboard = {
  enrolledCourses: EducationMyCourse[];
  upcomingMeetings: EducationMyUpcomingMeeting[];
};

export type CreatorCourseRow = {
  id: string;
  title: string;
  summary: string | null;
  published: boolean;
  enrolledCount: number;
  upcomingMeetingsCount: number;
};

export type CourseSessionRow = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
};

export function fetchEducationHub() {
  return apiFetch<EducationHub>('education/hub', { method: 'GET' });
}

export function fetchMyEducationDashboard() {
  return apiFetch<EducationMyDashboard>('education/my', { method: 'GET' });
}

export function fetchCreatorCourses(limit = 40) {
  const q = new URLSearchParams({ limit: String(limit) }).toString();
  return apiFetch<CreatorCourseRow[]>(`education/creator/my?${q}`, { method: 'GET' });
}

export function fetchEducationCourses(query?: { mine?: boolean; public?: boolean; upcoming?: boolean }) {
  const params = new URLSearchParams();
  if (query?.mine) params.set('mine', 'true');
  if (query?.public) params.set('public', 'true');
  if (query?.upcoming) params.set('upcoming', 'true');
  const q = params.toString();
  return apiFetch<EducationCourse[]>(`education/courses${q ? `?${q}` : ''}`, { method: 'GET' });
}

export function fetchEducationCourse(id: string) {
  return apiFetch<EducationCourse>(`education/courses/${encodeURIComponent(id)}`, { method: 'GET' });
}

export function createEducationCourse(body: {
  title: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  status?: 'DRAFT' | 'PUBLISHED';
  coverImageUrl?: string;
}) {
  return apiFetch<EducationCourse>('education/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchEducationCourse(
  id: string,
  body: {
    title?: string;
    description?: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    status?: 'DRAFT' | 'PUBLISHED';
    coverImageUrl?: string;
  },
) {
  return apiFetch<EducationCourse>(`education/courses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchCourseSessions(id: string) {
  return apiFetch<CourseSessionRow[]>(`education/courses/${encodeURIComponent(id)}/sessions`, {
    method: 'GET',
  });
}

export function createCourseSession(
  id: string,
  body: { title: string; startsAt: string; durationMinutes: number },
) {
  return apiFetch<CourseSessionRow>(`education/courses/${encodeURIComponent(id)}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function enrollCourse(id: string) {
  return apiFetch<{ ok: boolean; enrolled: boolean }>(
    `education/courses/${encodeURIComponent(id)}/enroll`,
    { method: 'POST' },
  );
}

export function unenrollCourse(id: string) {
  return apiFetch<{ ok: boolean }>(`education/courses/${encodeURIComponent(id)}/unenroll`, {
    method: 'POST',
  });
}
