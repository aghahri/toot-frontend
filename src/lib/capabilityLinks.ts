import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export type CapabilityKind = 'POLL' | 'FORM' | 'BULLETIN';
export type CapabilityTargetKind = 'NETWORK' | 'GROUP' | 'CHANNEL';

export type CapabilityLinkResolved =
  | {
      ok: true;
      kind: 'POLL';
      networkId: string;
      title: string;
      effectiveClosed: boolean;
      href: string;
    }
  | {
      ok: true;
      kind: 'BULLETIN';
      networkId: string;
      title: string;
      bulletinKind: string;
      href: string;
    }
  | {
      ok: true;
      kind: 'FORM';
      networkId: string;
      title: string;
      description: string | null;
      href: string;
    }
  | { ok: false; reason: 'NOT_FOUND' };

export type LinkedCapabilityRow = {
  id: string;
  capabilityType: CapabilityKind;
  capabilityId: string;
  sourceSpaceCategory: string;
  linkLabel: string | null;
  createdAt: string;
  linkedBy: { id: string; name: string };
  resolved: CapabilityLinkResolved;
};

export type CapabilityLinkTargetsPayload = {
  network: { id: string; name: string };
  groups: { id: string; name: string }[];
  channels: { id: string; name: string }[];
};

export async function fetchCapabilityLinkTargets(networkId: string): Promise<CapabilityLinkTargetsPayload> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch<CapabilityLinkTargetsPayload>(
    `networks/${encodeURIComponent(networkId)}/capability-link-targets`,
    { method: 'GET', token },
  );
}

export async function createCapabilityLink(body: {
  capabilityType: CapabilityKind;
  capabilityId: string;
  sourceSpaceCategory: 'NEIGHBORHOOD';
  targetEntityType: CapabilityTargetKind;
  targetEntityId: string;
  linkLabel?: string;
}): Promise<{ id: string; createdAt: string }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch<{ id: string; createdAt: string }>('capability-links', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteCapabilityLink(linkId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  await apiFetch(`capability-links/${encodeURIComponent(linkId)}`, { method: 'DELETE', token });
}

export async function fetchCapabilityLinksForTarget(
  targetType: CapabilityTargetKind,
  targetId: string,
): Promise<{ data: LinkedCapabilityRow[] }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  const path =
    targetType === 'GROUP'
      ? `groups/${encodeURIComponent(targetId)}/capability-links`
      : targetType === 'CHANNEL'
        ? `channels/${encodeURIComponent(targetId)}/capability-links`
        : `networks/${encodeURIComponent(targetId)}/capability-links`;
  return apiFetch<{ data: LinkedCapabilityRow[] }>(path, { method: 'GET', token });
}
