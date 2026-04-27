import { apiFetch } from '@/lib/api';

export type MeetingHost = {
  id: string;
  name: string;
  avatar: string | null;
  username: string;
};

export type MeetingRow = {
  id: string;
  title: string;
  description: string | null;
  hostUserId: string;
  networkId: string | null;
  groupId: string | null;
  channelId: string | null;
  sourceSpaceCategory: string;
  startsAt: string;
  durationMinutes: number;
  roomCode: string;
  status: string;
  maxParticipants: number | null;
  endedAt: string | null;
  meetingType: string;
  allowGuests: boolean;
  educationLabel: string | null;
  createdAt: string;
  updatedAt: string;
  host: MeetingHost;
  businessMeetings?: Array<{
    business: {
      id: string;
      businessName: string;
    };
  }>;
  chatMessages?: Array<{
    id: string;
    text: string;
    createdAt: string;
    sender: { id: string; name: string };
  }>;
  _count?: { chatMessages?: number };
};

export type MeetingDetail = MeetingRow & {
  _meta: { isHost: boolean };
};

export type EducationHubResponse = {
  upcomingMeetings: MeetingRow[];
  myHostedMeetings: MeetingRow[];
  suggestedNetworks: Array<{
    id: string;
    name: string;
    description: string | null;
    networkType: string;
    spaceCategory: string;
  }>;
  myLearningNetworks: Array<{
    id: string;
    name: string;
    description: string | null;
    networkType: string;
    spaceCategory: string;
  }>;
};

export type JoinTokenResponse = {
  token: string;
  meetingId: string;
  expiresInSec: number;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  workerHint?: { note: string };
};

export type MeetingChatMessage = {
  id: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
};

export function fetchEducationHub() {
  return apiFetch<EducationHubResponse>('meetings/education/hub', { method: 'GET' });
}

export function fetchMeeting(id: string) {
  return apiFetch<MeetingDetail>(`meetings/${encodeURIComponent(id)}`, { method: 'GET' });
}

export function fetchMyMeetings(limit = 40) {
  const q = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.min(100, Math.floor(limit)))}` : '';
  return apiFetch<MeetingRow[]>(`meetings/my${q}`, { method: 'GET' });
}

export function createMeeting(body: Record<string, unknown>) {
  return apiFetch<MeetingRow>('meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchMeeting(id: string, body: Record<string, unknown>) {
  return apiFetch<MeetingRow>(`meetings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function startMeeting(id: string) {
  return apiFetch<MeetingRow>(`meetings/${encodeURIComponent(id)}/start`, { method: 'POST' });
}

export function endMeeting(id: string) {
  return apiFetch<MeetingRow>(`meetings/${encodeURIComponent(id)}/end`, { method: 'POST' });
}

export function cancelMeeting(id: string) {
  return apiFetch<MeetingRow>(`meetings/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export function fetchJoinToken(id: string) {
  return apiFetch<JoinTokenResponse>(`meetings/${encodeURIComponent(id)}/join-token`, {
    method: 'POST',
  });
}

export function fetchMeetingChat(id: string, limit = 50) {
  const q = Number.isFinite(limit) ? `?limit=${Math.max(1, Math.min(100, Math.floor(limit)))}` : '';
  return apiFetch<MeetingChatMessage[]>(`meetings/${encodeURIComponent(id)}/chat${q}`, {
    method: 'GET',
  });
}
