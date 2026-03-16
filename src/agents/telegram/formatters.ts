import { config } from "../../config.js";
import type { Decision, NotificationPayload } from "../../types.js";

/** Escape HTML special chars for Telegram parse_mode: "HTML" */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Format a Decision into a NotificationPayload ready for Telegram.
 * Pure function — no side effects. Easy to test.
 */
export function formatNotification(decision: Decision): NotificationPayload {
  const { item, pricing, ai, score, level } = decision;

  const levelEmoji = decision.personal
    ? "👤 Dla siebie"
    : level === "hot" ? "🔥 HOT DEAL" : "📦 Okazja";
  const discountStr = pricing.discountPct > 0 ? `-${pricing.discountPct.toFixed(0)}%` : "";
  const medianStr = pricing.p25Price > 0 ? `rynek: ${pricing.p25Price} PLN` : "brak danych";

  const priceLine = `${item.price} ${item.currency} (${medianStr}, ${discountStr})`;
  const scoreLine = `⭐ ${score.toFixed(1)} / 10 — ${levelEmoji}`;
  const profitLine =
    ai.estimatedProfit > 0
      ? `💰 Szacowany zysk: ~${ai.estimatedProfit} PLN (sprzedaż za ~${ai.suggestedPrice} PLN)`
      : `💸 Szacowany zysk: ${ai.estimatedProfit} PLN`;

  // Score breakdown for "Dlaczego hot?" callback
  const riskFlagsFiltered = ai.riskFlags.filter(f => f !== "missing_details");
  const breakdown = [
    `📊 Breakdown scoringu:`,
    `  💰 Cena vs rynek: ${pricing.priceDiscountScore.toFixed(1)}/10 (waga 60%)`,
    `  🏷️ Marka: ${ai.brandLiquidity}/10 (waga 15%)`,
    `  ✅ Stan: ${ai.conditionConfidence}/10 (waga 15%)`,
    `  📏 Rozmiar / 👤 Sprzedawca: bonus`,
    pricing.sampleSize < 10 ? `  ⚠️ Mała baza (${pricing.sampleSize} próbek)` : "",
    riskFlagsFiltered.length > 0 ? `  🚩 Ryzyka: ${riskFlagsFiltered.map(escapeHtml).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const safeTitle = escapeHtml(item.title);
  const safeBrand = item.brand ? escapeHtml(item.brand) : "";

  return {
    photoUrl: item.photoUrls[0] || "",
    title: `${safeBrand ? `[${safeBrand}] ` : ""}${safeTitle}`,
    priceLine,
    scoreLine,
    profitLine,
    aiReasoning: ai.reasoning,
    riskFlags: riskFlagsFiltered,
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
  ];

  if (payload.riskFlags.length > 0) {
    lines.push("", `🚩 <b>Ryzyka:</b> ${payload.riskFlags.map(escapeHtml).join(", ")}`);
  }

  return lines.join("\n");
}
