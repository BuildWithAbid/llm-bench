import type { ModelState, FinalModelResult } from "./types.js";

export function scoreResults(
  prompt: string,
  completedModels: Array<{
    name: string;
    model: string;
    elapsedMs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    text: string;
  }>,
): FinalModelResult[] {
  if (completedModels.length === 0) return [];

  const fastestTime = Math.min(...completedModels.map((m) => m.elapsedMs));
  const cheapestCost = Math.min(...completedModels.map((m) => m.costUsd));

  return completedModels
    .map((m) => {
      const speedScore = fastestTime > 0 ? (fastestTime / m.elapsedMs) * 10 : 10;
      const costScore =
        cheapestCost > 0 && m.costUsd > 0
          ? (cheapestCost / m.costUsd) * 10
          : 10;
      const qualityScore = computeQualityScore(prompt, m.text);
      const overallScore =
        speedScore * 0.3 + costScore * 0.3 + qualityScore * 0.4;

      return {
        ...m,
        speedScore: round2(speedScore),
        costScore: round2(costScore),
        qualityScore: round2(qualityScore),
        overallScore: round2(overallScore),
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}

function computeQualityScore(prompt: string, response: string): number {
  // Length factor (40%): responses up to ~500 chars get full marks
  const lengthScore = Math.min(response.length / 500, 1.0) * 10;

  // Keyword overlap (60%): how many prompt words appear in the response
  const promptWords = extractSignificantWords(prompt);
  if (promptWords.length === 0) {
    return lengthScore;
  }

  const responseLower = response.toLowerCase();
  const matchedWords = promptWords.filter((word) =>
    responseLower.includes(word),
  );
  const overlapScore = (matchedWords.length / promptWords.length) * 10;

  return lengthScore * 0.4 + overlapScore * 0.6;
}

function extractSignificantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
