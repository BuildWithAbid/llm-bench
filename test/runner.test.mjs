import test from "node:test";
import assert from "node:assert/strict";
import { runBenchmark } from "../dist/runner.js";

test("runBenchmark rejects when every provider fails", async () => {
  const providers = [
    {
      name: "A",
      model: "a",
      envKey: "A",
      costPerInputToken: 0,
      costPerOutputToken: 0,
      async run() {
        throw new Error("boom-a");
      },
    },
    {
      name: "B",
      model: "b",
      envKey: "B",
      costPerInputToken: 0,
      costPerOutputToken: 0,
      async run() {
        throw new Error("boom-b");
      },
    },
  ];

  await assert.rejects(
    () => runBenchmark("prompt", providers, undefined, () => {}),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.message, /All providers failed\./);
      assert.match(error.message, /A: boom-a/);
      assert.match(error.message, /B: boom-b/);
      return true;
    },
  );
});

test("runBenchmark estimates live tokens from streamed text", async () => {
  const updates = [];
  const provider = {
    name: "Streamer",
    model: "streamer",
    envKey: "STREAMER",
    costPerInputToken: 0,
    costPerOutputToken: 0,
    async run(prompt, systemPrompt, onToken) {
      onToken("one two three four five");
      return {
        text: "one two three four five",
        inputTokens: 5,
        outputTokens: 5,
      };
    },
  };

  await runBenchmark("prompt", [provider], undefined, (name, state) => {
    updates.push({ name, ...state });
  });

  const streamingUpdate = updates.find(
    (update) =>
      update.status === "streaming" &&
      typeof update.tokensReceived === "number" &&
      update.tokensReceived > 0,
  );

  assert.ok(streamingUpdate);
  assert.ok(streamingUpdate.tokensReceived > 1);
});
