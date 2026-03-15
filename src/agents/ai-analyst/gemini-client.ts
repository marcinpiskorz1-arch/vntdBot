import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY not set — enable AI with /set ai_enabled 1 and set the env var");
    }
    _genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return _genAI;
}

/**
 * Standard Gemini model (text-only, structured output).
 * Reused pattern from AiDevsPlayground.
 */
export function getModel() {
  return getGenAI().getGenerativeModel({ model: config.geminiModel });
}

/**
 * Gemini model with custom generation config (for structured JSON output).
 */
export function getStructuredModel(responseSchema: Record<string, unknown>) {
  return getGenAI().getGenerativeModel({
    model: config.geminiModel,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
    },
  });
}
