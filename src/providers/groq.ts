import Groq from "groq-sdk";
import type { LLMProvider, ProviderResult } from "../types.js";
import { estimatePromptTokens, estimateTokenCount } from "../tokens.js";

const groqProvider: LLMProvider = {
  name: "Llama 3.3-70b",
  model: "llama-3.3-70b-versatile",
  aliases: ["llama-3.3-70b"],
  envKey: "GROQ_API_KEY",
  costPerInputToken: 0.00059 / 1000,
  costPerOutputToken: 0.00079 / 1000,

  async run(prompt, systemPrompt, onToken): Promise<ProviderResult> {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
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
      if (chunk.x_groq?.usage) {
        inputTokens = chunk.x_groq.usage.prompt_tokens ?? 0;
        outputTokens = chunk.x_groq.usage.completion_tokens ?? 0;
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

export default groqProvider;
