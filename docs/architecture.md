# Architecture Guide

This document explains how `llm-bench` is structured today so contributors can reason about behavior before changing the code.

## High-Level Flow

The benchmark pipeline is:

1. Parse CLI input.
2. Load optional config defaults.
3. Filter providers by model selection and available API keys.
4. Start the Ink terminal UI.
5. Run providers in parallel.
6. Stream live status updates into the UI.
7. Score successful results.
8. Write text and HTML result cards.
9. Exit with a success or failure code.

## Main Modules

| Module | Responsibility |
| --- | --- |
| `src/cli.ts` | Entry point, option parsing, config loading, provider filtering |
| `src/ui.tsx` | Live terminal UI, final success and failure handling, card generation |
| `src/runner.ts` | Parallel provider execution and per-provider state updates |
| `src/scoring.ts` | Speed, cost, quality, and overall ranking |
| `src/card.ts` | Text and HTML card generation plus file writes |
| `src/tokens.ts` | Shared token estimation helpers |
| `src/providers/*.ts` | Provider-specific API integrations |
| `src/types.ts` | Shared interfaces |

## Request Lifecycle

### CLI layer

`src/cli.ts`:

- Parses the `run` command.
- Reads `llm-bench.config.json` when available.
- Builds the selected provider list.
- Skips providers whose required API keys are missing.
- Starts the UI by calling `renderUI`.

### UI layer

`src/ui.tsx`:

- Initializes one row per provider.
- Receives state updates from the runner.
- Shows streaming status, token counts, timing, and cost.
- Shows either a successful completion state or a fatal failure state.
- Writes cards after a successful benchmark result.
- Exits non-zero if the benchmark or file generation fails.

### Runner layer

`src/runner.ts`:

- Runs all selected providers concurrently with `Promise.allSettled`.
- Updates live state through the `onUpdate` callback.
- Collects only successful provider results for scoring.
- Throws an `AggregateError` if all providers fail.
- Uses text-based token estimation during streaming so the live token count is not tied to SDK chunk callback frequency.

### Provider layer

Each provider implementation:

- Creates the provider SDK client.
- Maps the shared prompt and optional system prompt to the provider's API.
- Streams text chunks back through `onToken`.
- Returns final `text`, `inputTokens`, and `outputTokens`.

Current providers:

- `src/providers/openai.ts`
- `src/providers/anthropic.ts`
- `src/providers/google.ts`
- `src/providers/groq.ts`

## Scoring Model

`src/scoring.ts` ranks successful runs using three values:

- Speed score
- Cost score
- Quality score

Important detail:

- The quality score is heuristic. It is based on response length and keyword overlap, not semantic correctness or a judge model.

This keeps the tool fast and cheap, but it also means the score is directional rather than authoritative.

## Output Model

`src/card.ts` generates two files:

- Text card
- HTML card

Design details:

- The HTML output is self-contained.
- The base output path is normalized so users can pass a path with or without `.txt` or `.html`.
- Parent directories are created before writing.

## Failure Semantics

There are three important failure cases:

### No providers available

If none of the selected providers has a configured API key, the CLI fails immediately.

### Partial provider failure

If one or more providers fail but at least one succeeds:

- Failed rows are shown in the UI.
- Successful rows are still scored.
- Result cards are still written from successful results.

### Total failure

If every provider fails:

- The runner throws an `AggregateError`.
- The UI reports a fatal failure.
- The process exits with code `1`.
- No result cards are written.

## Extension Points

### Add a provider

To add a provider safely:

1. Implement `LLMProvider` in a new file under `src/providers/`.
2. Return native usage data whenever the SDK exposes it.
3. Call `onToken` with text chunks as they stream.
4. Register the provider in `src/cli.ts`.
5. Add tests for any provider-specific mapping logic.

### Add new output formats

`src/card.ts` is the natural place to add:

- JSON summaries
- CSV export
- Image or PNG generation

### Improve evaluation

If you want a stronger benchmark signal, the main upgrade path is replacing or supplementing the quality heuristic with:

- LLM-as-a-judge scoring
- Task-specific assertions
- Human review workflows

## Current Technical Constraints

These are implementation realities contributors should understand:

- Pricing is hard-coded per provider and can drift if vendors change pricing.
- The quality score is intentionally shallow.
- There is no persistence layer or database.
- The project is optimized for quick comparisons, not long-running benchmark suites.
