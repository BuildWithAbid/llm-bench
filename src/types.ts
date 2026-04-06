export interface LLMProvider {
  name: string;
  model: string;
  aliases?: string[];
  envKey: string;
  costPerInputToken: number;
  costPerOutputToken: number;
  run(
    prompt: string,
    systemPrompt: string | undefined,
    onToken: (token: string) => void,
  ): Promise<ProviderResult>;
}

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelState {
  name: string;
  model: string;
  status: "waiting" | "streaming" | "done" | "failed";
  tokensReceived: number;
  elapsedMs: number;
  costUsd: number;
  error?: string;
  result?: ProviderResult;
}

export interface FinalModelResult {
  name: string;
  model: string;
  elapsedMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  text: string;
  speedScore: number;
  costScore: number;
  qualityScore: number;
  overallScore: number;
}

export interface BenchmarkResult {
  prompt: string;
  models: FinalModelResult[];
  timestamp: string;
}

export interface BenchConfig {
  models?: string[];
  systemPrompt?: string;
}
