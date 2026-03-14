import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Standard Gemini model (text-only, structured output).
 * Reused pattern from AiDevsPlayground.
 */
export function getModel() {
  return genAI.getGenerativeModel({ model: config.geminiModel });
}

/**
 * Gemini model with custom generation config (for structured JSON output).
 */
export function getStructuredModel(responseSchema: Record<string, unknown>) {
  return genAI.getGenerativeModel({
    model: config.geminiModel,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
    },
  });
}
