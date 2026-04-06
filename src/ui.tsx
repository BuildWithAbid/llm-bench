import React, { useCallback, useEffect, useState } from "react";
import { render, Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import type { LLMProvider, ModelState, FinalModelResult } from "./types.js";
import { runBenchmark } from "./runner.js";
import { generateCards, normalizeOutputBasePath } from "./card.js";

interface RaceUIProps {
  prompt: string;
  providers: LLMProvider[];
  systemPrompt?: string;
  outputPath?: string;
}

function StatusIndicator({ status }: { status: ModelState["status"] }) {
  switch (status) {
    case "waiting":
      return <Text dimColor>o waiting</Text>;
    case "streaming":
      return (
        <Text color="cyan">
          <Spinner type="dots" /> streaming
        </Text>
      );
    case "done":
      return <Text color="green">done</Text>;
    case "failed":
      return <Text color="red">failed</Text>;
  }
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "-";
  if (cost < 0.0001) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function ModelRow({
  state,
  isWinner,
}: {
  state: ModelState;
  isWinner: boolean;
}) {
  return (
    <Box>
      <Box width={22}>
        <Text bold={isWinner} color={isWinner ? "green" : undefined}>
          {isWinner ? "* " : "  "}
          {state.name}
        </Text>
      </Box>
      <Box width={16}>
        <StatusIndicator status={state.status} />
      </Box>
      <Box width={10}>
        <Text>{state.tokensReceived > 0 ? state.tokensReceived : "-"}</Text>
      </Box>
      <Box width={10}>
        <Text>{state.elapsedMs > 0 ? formatTime(state.elapsedMs) : "-"}</Text>
      </Box>
      <Box width={12}>
        <Text>{state.costUsd > 0 ? formatCost(state.costUsd) : "-"}</Text>
      </Box>
      {state.error && (
        <Box>
          <Text color="red" dimColor>
            {" "}
            {state.error.slice(0, 60)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function ScoreTable({ results }: { results: FinalModelResult[] }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold underline>
        Final Scores
      </Text>
      <Box marginTop={1}>
        <Box width={5}>
          <Text bold dimColor>
            #
          </Text>
        </Box>
        <Box width={22}>
          <Text bold dimColor>
            Model
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Speed
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Cost
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Quality
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Overall
          </Text>
        </Box>
      </Box>
      {results.map((result, index) => (
        <Box key={result.name}>
          <Box width={5}>
            <Text color={index === 0 ? "green" : undefined} bold={index === 0}>
              {index + 1}.
            </Text>
          </Box>
          <Box width={22}>
            <Text color={index === 0 ? "green" : undefined} bold={index === 0}>
              {result.name}
            </Text>
          </Box>
          <Box width={10}>
            <Text>{result.speedScore.toFixed(1)}</Text>
          </Box>
          <Box width={10}>
            <Text>{result.costScore.toFixed(1)}</Text>
          </Box>
          <Box width={10}>
            <Text>{result.qualityScore.toFixed(1)}</Text>
          </Box>
          <Box width={10}>
            <Text color={index === 0 ? "green" : undefined} bold={index === 0}>
              {result.overallScore.toFixed(1)}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function RaceUI({ prompt, providers, systemPrompt, outputPath }: RaceUIProps) {
  const { exit } = useApp();
  const [models, setModels] = useState<Map<string, ModelState>>(() => {
    const initial = new Map<string, ModelState>();
    for (const provider of providers) {
      initial.set(provider.name, {
        name: provider.name,
        model: provider.model,
        status: "waiting",
        tokensReceived: 0,
        elapsedMs: 0,
        costUsd: 0,
      });
    }
    return initial;
  });
  const [results, setResults] = useState<FinalModelResult[] | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [savedPaths, setSavedPaths] = useState<{
    txtPath: string;
    htmlPath: string;
  } | null>(null);

  const onUpdate = useCallback(
    (name: string, update: Partial<ModelState>) => {
      setModels((previous) => {
        const next = new Map(previous);
        const existing = next.get(name);
        if (existing) {
          next.set(name, { ...existing, ...update });
        }
        return next;
      });
    },
    [],
  );

  const outputBasePath = normalizeOutputBasePath(outputPath || "result-card");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const finalResults = await runBenchmark(
          prompt,
          providers,
          systemPrompt,
          onUpdate,
        );

        if (cancelled) return;
        setResults(finalResults);

        const cardPaths = await generateCards(
          prompt,
          finalResults,
          outputBasePath,
        );

        if (cancelled) return;
        setSavedPaths(cardPaths);
        setAllDone(true);
      } catch (error) {
        if (cancelled) return;
        setFatalError(
          error instanceof Error ? error : new Error(String(error)),
        );
        setAllDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onUpdate, outputBasePath, prompt, providers, systemPrompt]);

  useEffect(() => {
    if (!allDone) return;

    if (fatalError) {
      process.exitCode = 1;
      exit(fatalError);
      return;
    }

    exit();
  }, [allDone, exit, fatalError]);

  const modelEntries = Array.from(models.values());
  const winnerName =
    allDone && results && results.length > 0 ? results[0].name : null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          LLM Bench
        </Text>
        <Text dimColor> - </Text>
        {allDone && fatalError ? (
          <Text color="red">Race failed</Text>
        ) : allDone ? (
          <Text color="green">Race complete</Text>
        ) : (
          <Text>Racing {providers.length} models...</Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Prompt: </Text>
        <Text>{prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt}</Text>
      </Box>

      <Box>
        <Box width={22}>
          <Text bold dimColor>
            Model
          </Text>
        </Box>
        <Box width={16}>
          <Text bold dimColor>
            Status
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Tokens
          </Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>
            Time
          </Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>
            Cost
          </Text>
        </Box>
      </Box>

      <Box marginBottom={0}>
        <Text dimColor>{"-".repeat(70)}</Text>
      </Box>

      {modelEntries.map((state) => (
        <ModelRow
          key={state.name}
          state={state}
          isWinner={state.name === winnerName}
        />
      ))}

      {winnerName && results?.[0] && (
        <Box marginTop={1}>
          <Text color="green" bold>
            Winner: {winnerName}
          </Text>
          <Text dimColor>
            {" "}
            ({formatTime(results[0].elapsedMs)}, {formatCost(results[0].costUsd)},
            {" "}score: {results[0].overallScore.toFixed(1)})
          </Text>
        </Box>
      )}

      {results && <ScoreTable results={results} />}

      {fatalError && (
        <Box marginTop={1}>
          <Text color="red">{fatalError.message}</Text>
        </Box>
      )}

      {allDone && savedPaths && !fatalError && (
        <Box marginTop={1}>
          <Text dimColor>
            Cards saved to {savedPaths.txtPath} and {savedPaths.htmlPath}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export function renderUI(props: RaceUIProps): void {
  const { waitUntilExit } = render(<RaceUI {...props} />);

  void waitUntilExit()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
