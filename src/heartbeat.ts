import { settings } from "./settings.js";
import { botState } from "./bot-state.js";

interface HeartbeatData {
  uptime: number;
  aiQueueCount: number;
}

/** Build the hourly heartbeat Telegram message */
export function buildHeartbeatMessage({ uptime, aiQueueCount }: HeartbeatData): string {
  const stats = botState.stats;
  const aiOn = settings.aiEnabled;

  const lines = [
    `💓 Heartbeat — ${new Date().toLocaleTimeString("pl-PL")}`,
    ``,
    settings.paused ? `⏸️ BOT WSTRZYMANY` : `▶️ Aktywny`,
    `🧮 Scoring: ${aiOn ? "AI (Gemini)" : "rule-based"}`,
    ``,
    `📊 Od ostatniego raportu (${uptime} min):`,
    `  🔄 Cykli: ${stats.cycles}`,
    `  🔍 Sprawdzono ofert: ${stats.scanned}`,
    `  🚫 Odfiltrowano: ${stats.filtered}`,
    `  💰 Zaniżona cena: ${stats.underpriced}`,
    `  🧠 Ocenionych: ${stats.aiAnalyzed}`,
    `  📩 Powiadomień: ${stats.notified}`,
    `  ❌ Błędów: ${stats.errors}`,
  ];

  if (aiOn) {
    const dailyPct = settings.dailyAiLimit > 0
      ? Math.round(botState.daily.aiCalls / settings.dailyAiLimit * 100)
      : 0;
    lines.push(`  📋 W kolejce AI: ${aiQueueCount}`);
    lines.push(``);
    lines.push(`🔒 Limit dzienny AI: ${botState.daily.aiCalls}/${settings.dailyAiLimit} (${dailyPct}%)`);
    if (dailyPct >= 80) lines.push(`⚠️ UWAGA: Zbliżasz się do dziennego limitu!`);
  }

  return lines.filter(Boolean).join("\n");
}
