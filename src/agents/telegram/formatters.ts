import { config } from "../../config.js";
import type { Decision, NotificationPayload } from "../../types.js";

/**
 * Format a Decision into a NotificationPayload ready for Telegram.
 * Pure function — no side effects. Easy to test.
 */
export function formatNotification(decision: Decision): NotificationPayload {
  const { item, pricing, ai, score, level } = decision;

  const levelEmoji = level === "hot" ? "🔥 HOT DEAL" : "📦 Okazja";
  const discountStr = pricing.discountPct > 0 ? `-${pricing.discountPct.toFixed(0)}%` : "";
  const medianStr = pricing.medianPrice > 0 ? `mediana: ${pricing.medianPrice} PLN` : "brak mediany";

  const priceLine = `${item.price} ${item.currency} (${medianStr}, ${discountStr})`;
  const scoreLine = `⭐ ${score.toFixed(1)} / 10 — ${levelEmoji}`;
  const profitLine =
    ai.estimatedProfit > 0
      ? `💰 Szacowany zysk: ~${ai.estimatedProfit} PLN (sprzedaż za ~${ai.suggestedPrice} PLN)`
      : `💸 Szacowany zysk: ${ai.estimatedProfit} PLN`;

  // Score breakdown for "Dlaczego hot?" callback
  const breakdown = [
    `📊 Breakdown scoringu:`,
    `  💰 Cena vs rynek: ${pricing.priceDiscountScore.toFixed(1)}/10 (waga 40%)`,
    `  📈 Potencjał odsprzedaży: ${ai.resalePotential}/10 (waga 30%)`,
    `  ✅ Pewność stanu: ${ai.conditionConfidence}/10 (waga 20%)`,
    `  🏷️ Płynność marki: ${ai.brandLiquidity}/10 (waga 10%)`,
    pricing.sampleSize < 10 ? `  ⚠️ Mała baza (${pricing.sampleSize} próbek)` : "",
    ai.riskFlags.length > 0 ? `  🚩 Ryzyka: ${ai.riskFlags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    photoUrl: item.photoUrls[0] || "",
    title: `${item.brand ? `[${item.brand}] ` : ""}${item.title}`,
    priceLine,
    scoreLine,
    profitLine,
    aiReasoning: ai.reasoning,
    riskFlags: ai.riskFlags,
    vintedUrl: item.url,
    scoreBreakdown: breakdown,
    itemId: item.vintedId,
  };
}

/**
 * Build the main notification message text.
 */
export function buildMessageText(payload: NotificationPayload): string {
  const lines = [
    `<b>${payload.title}</b>`,
    "",
    `${payload.scoreLine}`,
    `💵 ${payload.priceLine}`,
    payload.profitLine,
    "",
    `🧠 <i>${payload.aiReasoning}</i>`,
  ];

  if (payload.riskFlags.length > 0) {
    lines.push("", `🚩 <b>Ryzyka:</b> ${payload.riskFlags.join(", ")}`);
  }

  return lines.join("\n");
}
