'use client';

import { LinkedCapabilitiesPanel } from '@/components/capability/LinkedCapabilitiesPanel';
import type { LinkedCapabilitiesPanelProps } from '@/components/capability/LinkedCapabilitiesPanel';

/** Inline block (e.g. legacy); prefer CommunityToolsSheet + header button for chat-adjacent surfaces. */
export function LinkedCapabilitiesSection(props: Omit<LinkedCapabilitiesPanelProps, 'showWhenEmpty' | 'variant'>) {
  return <LinkedCapabilitiesPanel {...props} showWhenEmpty={false} variant="card" />;
}
