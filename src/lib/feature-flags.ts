function envTrue(v: string | undefined): boolean {
  return (v ?? '').trim() === '1' || (v ?? '').trim().toLowerCase() === 'true';
}

export const featureFlags = {
  aiNeighborhoodAssistant: envTrue(process.env.NEXT_PUBLIC_AI_NEIGHBORHOOD_ASSISTANT_ENABLED),
  aiGroupSummarizer: envTrue(process.env.NEXT_PUBLIC_AI_GROUP_SUMMARIZER_ENABLED),
  aiVoiceTranscribe: envTrue(process.env.NEXT_PUBLIC_AI_VOICE_TRANSCRIBE_ENABLED),
};
