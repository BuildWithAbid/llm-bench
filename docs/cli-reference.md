# CLI Reference

This document describes the current `llm-bench` command-line interface exactly as implemented in the codebase.

## Command Summary

```text
llm-bench run <prompt> [options]
```

## Required Argument

| Argument | Required | Description |
| --- | --- | --- |
| `prompt` | Yes | The user prompt sent to each selected provider |

## Options

| Option | Description |
| --- | --- |
| `-m, --models <models>` | Comma-separated model list such as `gpt-4o,gemini-2.5-flash` |
| `-s, --system <prompt>` | Optional system prompt applied to every selected provider |
| `-o, --output <path>` | Base output path for result cards, without requiring an extension |
| `-c, --config <path>` | Load defaults from a custom config file |
| `-V, --version` | Show CLI version |
| `-h, --help` | Show help |

## Supported Model Filters

Recommended model slugs:

- `gpt-4o`
- `claude-sonnet-4-6`
- `gemini-2.5-flash`
- `llama-3.3-70b`

Filtering behavior:

- The CLI matches user-facing slugs.
- It also matches provider display names.
- Providers without configured API keys are skipped.

## Output Behavior

If `--output` is omitted, the default base path is:

```text
result-card
```

This produces:

```text
result-card.txt
result-card.html
```

If you pass:

```bash
llm-bench run "Compare queues and streams" --output ./results/queues-vs-streams
```

The CLI writes:

```text
./results/queues-vs-streams.txt
./results/queues-vs-streams.html
```

Parent directories are created automatically.

## Config File Behavior

By default, the CLI tries to load:

```text
./llm-bench.config.json
```

Supported fields:

```json
{
  "models": ["gpt-4o", "gemini-2.5-flash"],
  "systemPrompt": "Be concise and practical."
}
```

Precedence:

- Command-line flags override config values.
- Missing or unreadable config files are ignored.

## Provider Selection Rules

The CLI starts from the built-in provider list, then narrows it by:

1. Requested model filters
2. Available environment variables

Examples:

- If you request `gpt-4o,gemini-2.5-flash` and only `OPENAI_API_KEY` is set, Gemini is skipped and only GPT-4o runs.
- If no selected provider has an API key, the CLI exits with code `1`.

## Exit Codes

| Exit Code | Meaning |
| --- | --- |
| `0` | At least one provider completed and result cards were written successfully |
| `1` | No providers available, all providers failed, or result card generation failed |

## Examples

### Run all available providers

```bash
llm-bench run "Explain event sourcing"
```

### Run a subset of providers

```bash
llm-bench run "Compare SQL and document databases" --models gpt-4o,llama-3.3-70b
```

### Apply a system prompt

```bash
llm-bench run "Explain API gateways" --system "Answer for a senior backend engineer."
```

### Write reports into a project folder

```bash
llm-bench run "Compare monoliths and microservices" --output ./benchmarks/monolith-vs-microservices
```
