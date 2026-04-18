import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export type CommunityGroupRow = {
  id: string;
  name: string;
  description: string | null;
  type: string;
};

export type CommunityChannelRow = {
  id: string;
  name: string;
  description: string | null;
};

export type CommunitySurfacesPayload = {
  groupCount: number;
  channelCount: number;
  groups: CommunityGroupRow[];
  channels: CommunityChannelRow[];
};

/** Member-only: groups + channels under a network (backend GET networks/:id/community-surfaces). */
export async function fetchNetworkCommunitySurfaces(networkId: string): Promise<CommunitySurfacesPayload> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch<CommunitySurfacesPayload>(`networks/${encodeURIComponent(networkId)}/community-surfaces`, {
    method: 'GET',
    token,
  });
}
