import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, ProviderResult } from "../types.js";

const anthropicProvider: LLMProvider = {
  name: "Claude Sonnet 4.6",
  model: "claude-sonnet-4-6",
  envKey: "ANTHROPIC_API_KEY",
  costPerInputToken: 0.003 / 1000,
  costPerOutputToken: 0.015 / 1000,

  async run(prompt, systemPrompt, onToken): Promise<ProviderResult> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: [{ role: "user", content: prompt }],
    });

    stream.on("text", (text) => {
      onToken(text);
    });

    const message = await stream.finalMessage();

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  },
};

export default anthropicProvider;
