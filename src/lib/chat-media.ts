export function isVoiceMedia(m: { type?: string; mimeType?: string } | null | undefined): boolean {
  if (!m) return false;
  if (m.type === 'VOICE') return true;
  return (m.mimeType ?? '').toLowerCase().startsWith('audio/');
}

export function formatVoiceClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
