import OpenAI from "openai";
import type { LLMProvider, ProviderResult } from "../types.js";
import { estimatePromptTokens, estimateTokenCount } from "../tokens.js";

const openaiProvider: LLMProvider = {
  name: "GPT-4o",
  model: "gpt-4o",
  envKey: "OPENAI_API_KEY",
  costPerInputToken: 0.0025 / 1000,
  costPerOutputToken: 0.01 / 1000,

  async run(prompt, systemPrompt, onToken): Promise<ProviderResult> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        text += content;
        onToken(content);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    if (inputTokens === 0) {
      inputTokens = estimatePromptTokens(prompt, systemPrompt);
    }
    if (outputTokens === 0) {
      outputTokens = estimateTokenCount(text);
    }

    return { text, inputTokens, outputTokens };
  },
};

export default openaiProvider;
