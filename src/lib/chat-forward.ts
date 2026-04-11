import { apiFetch } from '@/lib/api';

export type ForwardPickConversation = {
  id: string;
  participants: Array<{
    userId: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
      username?: string;
      phoneMasked?: string;
    };
  }>;
};

export type ForwardPickTarget =
  | {
      kind: 'direct';
      id: string;
      peer: {
        name: string;
        avatar: string | null;
        username?: string;
        phoneMasked?: string;
      };
    }
  | { kind: 'group'; id: string; name: string; memberCount: number };

export function forwardPickLabel(t: ForwardPickTarget): string {
  return t.kind === 'direct' ? t.peer.name : t.name;
}

export async function loadForwardPickTargets(
  token: string,
  myUserId: string | null,
  excludeDirectConversationId?: string | null,
  excludeGroupId?: string | null,
): Promise<ForwardPickTarget[]> {
  const [convRows, groupRows] = await Promise.all([
    apiFetch<ForwardPickConversation[]>('direct/conversations', {
      method: 'GET',
      token,
    }).catch(() => []),
    apiFetch<Array<{ id: string; name: string; memberCount?: number }>>('groups/conversations', {
      method: 'GET',
      token,
    }).catch(() => []),
  ]);

  const targets: ForwardPickTarget[] = [];

  for (const c of Array.isArray(convRows) ? convRows : []) {
    if (excludeDirectConversationId && c.id === excludeDirectConversationId) continue;
    const peerUser =
      c.participants.find((p) => p.userId !== myUserId)?.user ?? c.participants[0]?.user;
    targets.push({
      kind: 'direct',
      id: c.id,
      peer: {
        name: peerUser?.name?.trim() || 'مخاطب',
        avatar: peerUser?.avatar ?? null,
        username: peerUser?.username,
        phoneMasked: peerUser?.phoneMasked,
      },
    });
  }

  for (const g of Array.isArray(groupRows) ? groupRows : []) {
    if (excludeGroupId && g.id === excludeGroupId) continue;
    targets.push({
      kind: 'group',
      id: g.id,
      name: g.name?.trim() || 'گروه',
      memberCount: typeof g.memberCount === 'number' ? g.memberCount : 0,
    });
  }

  targets.sort((a, b) =>
    forwardPickLabel(a).localeCompare(forwardPickLabel(b), 'fa', { sensitivity: 'base' }),
  );

  return targets;
}
