import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateCards } from "../dist/card.js";

test("generateCards creates parent directories for nested output paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "llm-bench-"));
  const basePath = join(dir, "nested", "api-comparison");

  try {
    await generateCards(
      "prompt",
      [
        {
          name: "Model",
          model: "model",
          elapsedMs: 100,
          costUsd: 0.001,
          inputTokens: 10,
          outputTokens: 20,
          text: "response text",
          speedScore: 10,
          costScore: 9,
          qualityScore: 8,
          overallScore: 8.9,
        },
      ],
      basePath,
    );

    await access(`${basePath}.txt`);
    await access(`${basePath}.html`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  assert.ok(true);
});
