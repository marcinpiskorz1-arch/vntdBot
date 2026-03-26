import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { botState } from "../../bot-state.js";
import type { RawItem, PriceSignal, PhotoVerification } from "../../types.js";
import { getMultimodalModel } from "./gemini-client.js";
import {
  photoVerificationSchema,
  verificationSystemPrompt,
  buildVerificationPrompt,
} from "./prompts.js";

/** Reset daily counter if date changed (midnight rollover) */
function checkDailyReset(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (botState.daily.date !== today) {
    logger.info({ previousCalls: botState.daily.aiCalls, date: botState.daily.date }, "🔄 Daily AI counter reset (new day)");
    botState.daily.aiCalls = 0;
    botState.daily.date = today;
  }
}

/** Check if daily AI call limit has been reached */
function isDailyLimitReached(): boolean {
  checkDailyReset();
  return botState.daily.aiCalls >= settings.dailyAiLimit;
}

export class AiAnalystAgent {
  private _verifyModel: ReturnType<typeof getMultimodalModel> | null = null;

  private get verifyModel() {
    if (!this._verifyModel) {
      this._verifyModel = getMultimodalModel(photoVerificationSchema);
    }
    return this._verifyModel;
  }

  /**
   * Verify item with photo — multimodal (image + text).
   * Used for items with vague titles that scored well on rules.
   * Returns confirmed=true to notify, confirmed=false to reject.
   * On error: returns confirmed=true (conservative — don't block good deals).
   */
  async verifyWithPhoto(item: RawItem, signal: PriceSignal): Promise<PhotoVerification> {
    if (isDailyLimitReached()) {
      logger.warn({ dailyCalls: botState.daily.aiCalls, limit: settings.dailyAiLimit }, "🛑 Daily AI limit — auto-confirming item");
      return { confirmed: true, identifiedModel: "limit_reached", reason: "Dzienny limit AI — przepuszczam bez weryfikacji." };
    }

    const photoUrl = item.photoUrls?.[0];
    if (!photoUrl) {
      logger.warn({ item: item.vintedId }, "No photo URL — auto-confirming");
      return { confirmed: true, identifiedModel: "brak_zdjęcia", reason: "Brak zdjęcia — przepuszczam bez weryfikacji." };
    }

    const textPrompt = buildVerificationPrompt(
      item.title,
      item.brand,
      item.price,
      signal.medianPrice,
      item.condition,
    );

    try {
      // Fetch image and convert to base64 for Gemini multimodal
      const imageResponse = await fetch(photoUrl);
      if (!imageResponse.ok) {
        logger.warn({ item: item.vintedId, status: imageResponse.status }, "Failed to fetch photo — auto-confirming");
        return { confirmed: true, identifiedModel: "zdjęcie_niedostępne", reason: "Nie udało się pobrać zdjęcia — przepuszczam." };
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const base64Image = imageBuffer.toString("base64");
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

      const result = await this.verifyModel.generateContent({
        contents: [
          { role: "user", parts: [{ text: verificationSystemPrompt }] },
          { role: "model", parts: [{ text: "Rozumiem. Analizuję zdjęcie i weryfikuję przedmiot." }] },
          {
            role: "user",
            parts: [
              { text: textPrompt },
              { inlineData: { mimeType: contentType, data: base64Image } },
            ],
          },
        ],
      });

      const text = result.response.text();
      const parsed = JSON.parse(text) as PhotoVerification;

      botState.daily.aiCalls++;

      logger.info(
        {
          item: item.vintedId,
          confirmed: parsed.confirmed,
          model: parsed.identifiedModel,
          reason: parsed.reason,
        },
        "📸 Photo verification complete"
      );

      return parsed;
    } catch (err) {
      logger.error({ err, item: item.vintedId }, "Photo verification failed — auto-confirming");
      return { confirmed: true, identifiedModel: "weryfikacja_błąd", reason: "Weryfikacja AI nie powiodła się — przepuszczam." };
    }
  }
}
