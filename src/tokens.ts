export function estimateTokenCount(text: string | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimatePromptTokens(
  prompt: string,
  systemPrompt?: string,
): number {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  return estimateTokenCount(fullPrompt);
}
