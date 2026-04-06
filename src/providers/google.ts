import { GoogleGenAI } from "@google/genai";
import type { LLMProvider, ProviderResult } from "../types.js";
import { estimatePromptTokens, estimateTokenCount } from "../tokens.js";

const googleProvider: LLMProvider = {
  name: "Gemini 2.5 Flash",
  model: "gemini-2.5-flash",
  envKey: "GOOGLE_API_KEY",
  costPerInputToken: 0.0003 / 1000,
  costPerOutputToken: 0.0025 / 1000,

  async run(prompt, systemPrompt, onToken): Promise<ProviderResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of response) {
      const content = chunk.text;
      if (content) {
        text += content;
        onToken(content);
      }
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
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

export default googleProvider;
