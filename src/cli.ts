#!/usr/bin/env node

import { program } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LLMProvider, BenchConfig } from "./types.js";
import openaiProvider from "./providers/openai.js";
import anthropicProvider from "./providers/anthropic.js";
import googleProvider from "./providers/google.js";
import groqProvider from "./providers/groq.js";
import { renderUI } from "./ui.js";

const ALL_PROVIDERS: LLMProvider[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
  groqProvider,
];

function loadConfig(configPath?: string): BenchConfig {
  const path = configPath || resolve(process.cwd(), "llm-bench.config.json");
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as BenchConfig;
  } catch {
    return {};
  }
}

function filterProviders(
  modelFilter?: string[],
): { available: LLMProvider[]; skipped: string[] } {
  let candidates = ALL_PROVIDERS;

  if (modelFilter && modelFilter.length > 0) {
    const filterSet = new Set(modelFilter.map((m) => m.toLowerCase()));
    candidates = ALL_PROVIDERS.filter(
      (p) =>
        filterSet.has(p.model.toLowerCase()) ||
        filterSet.has(p.name.toLowerCase()) ||
        p.aliases?.some((alias) => filterSet.has(alias.toLowerCase())) === true,
    );
  }

  const available: LLMProvider[] = [];
  const skipped: string[] = [];

  for (const p of candidates) {
    if (process.env[p.envKey]) {
      available.push(p);
    } else {
      skipped.push(`${p.name} (missing ${p.envKey})`);
    }
  }

  return { available, skipped };
}

program
  .name("llm-bench")
  .description(
    "Race LLM providers head-to-head — compare speed, cost, and quality in real time",
  )
  .version("1.0.0");

program
  .command("run")
  .description("Run a benchmark race with a prompt")
  .argument("<prompt>", "The prompt to send to all models")
  .option("-m, --models <models>", "Comma-separated list of models to race")
  .option("-o, --output <path>", "Output path for result cards (without extension)")
  .option("-s, --system <prompt>", "System prompt to prepend")
  .option("-c, --config <path>", "Path to config file")
  .action(
    (
      prompt: string,
      opts: {
        models?: string;
        output?: string;
        system?: string;
        config?: string;
      },
    ) => {
      const config = loadConfig(opts.config);

      const modelFilter =
        opts.models?.split(",").map((m) => m.trim()) ?? config.models;
      const systemPrompt = opts.system ?? config.systemPrompt;
      const outputPath = opts.output ?? "result-card";

      const { available, skipped } = filterProviders(modelFilter);

      if (skipped.length > 0) {
        for (const s of skipped) {
          console.log(`⚠ Skipping ${s}`);
        }
        console.log();
      }

      if (available.length === 0) {
        console.error(
          "✗ No models available. Set at least one API key:\n" +
            "  OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY",
        );
        process.exit(1);
      }

      renderUI({
        prompt,
        providers: available,
        systemPrompt,
        outputPath,
      });
    },
  );

program.parse();
