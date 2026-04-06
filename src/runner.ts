import type { LLMProvider, ModelState, FinalModelResult } from "./types.js";
import { scoreResults } from "./scoring.js";
import { estimatePromptTokens, estimateTokenCount } from "./tokens.js";

export async function runBenchmark(
  prompt: string,
  providers: LLMProvider[],
  systemPrompt: string | undefined,
  onUpdate: (name: string, state: Partial<ModelState>) => void,
): Promise<FinalModelResult[]> {
  const tasks = providers.map((provider) =>
    runSingleProvider(provider, prompt, systemPrompt, onUpdate),
  );

  const results = await Promise.allSettled(tasks);

  const completedModels: Array<{
    name: string;
    model: string;
    elapsedMs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    text: string;
  }> = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      completedModels.push(result.value);
    }
  });

  if (completedModels.length === 0) {
    const providerErrors = results
      .map((result, i) => {
        if (result.status !== "rejected") return null;
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        return `${providers[i]?.name ?? `provider-${i + 1}`}: ${errorMessage}`;
      })
      .filter((error): error is string => Boolean(error));

    throw new AggregateError(
      results
        .filter(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        )
        .map((result) =>
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
        ),
      `All providers failed.\n${providerErrors.join("\n")}`,
    );
  }

  return scoreResults(prompt, completedModels);
}

async function runSingleProvider(
  provider: LLMProvider,
  prompt: string,
  systemPrompt: string | undefined,
  onUpdate: (name: string, state: Partial<ModelState>) => void,
): Promise<{
  name: string;
  model: string;
  elapsedMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  text: string;
}> {
  const startTime = performance.now();
  const estimatedInputTokens = estimatePromptTokens(prompt, systemPrompt);
  let streamedText = "";

  onUpdate(provider.name, {
    status: "streaming",
    tokensReceived: 0,
    elapsedMs: 0,
    costUsd: 0,
  });

  try {
    const result = await provider.run(prompt, systemPrompt, (token) => {
      streamedText += token;
      const tokensReceived = estimateTokenCount(streamedText);
      const elapsed = performance.now() - startTime;
      const estimatedCost =
        estimatedInputTokens * provider.costPerInputToken +
        tokensReceived * provider.costPerOutputToken;

      onUpdate(provider.name, {
        status: "streaming",
        tokensReceived,
        elapsedMs: Math.round(elapsed),
        costUsd: estimatedCost,
      });
    });

    const elapsed = performance.now() - startTime;
    const finalCost =
      result.inputTokens * provider.costPerInputToken +
      result.outputTokens * provider.costPerOutputToken;

    onUpdate(provider.name, {
      status: "done",
      tokensReceived: result.outputTokens,
      elapsedMs: Math.round(elapsed),
      costUsd: finalCost,
      result,
    });

    return {
      name: provider.name,
      model: provider.model,
      elapsedMs: Math.round(elapsed),
      costUsd: finalCost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      text: result.text,
    };
  } catch (err) {
    const elapsed = performance.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    onUpdate(provider.name, {
      status: "failed",
      elapsedMs: Math.round(elapsed),
      error: errorMessage,
    });

    throw err;
  }
}
