import { settings } from "./settings.js";
import { botState } from "./bot-state.js";

interface HeartbeatData {
  uptime: number;
  aiQueueCount: number;
}

/** Build the hourly heartbeat Telegram message */
export function buildHeartbeatMessage({ uptime, aiQueueCount }: HeartbeatData): string {
  const stats = botState.stats;
  const dailyPct = settings.dailyAiLimit > 0
    ? Math.round(botState.daily.aiCalls / settings.dailyAiLimit * 100)
    : 0;

  return [
    `💓 Heartbeat — ${new Date().toLocaleTimeString("pl-PL")}`,
    ``,
    settings.paused ? `⏸️ BOT WSTRZYMANY` : `▶️ Aktywny`,
    ``,
    `📊 Od ostatniego raportu (${uptime} min):`,
    `  🔄 Cykli: ${stats.cycles}`,
    `  🔍 Sprawdzono ofert: ${stats.scanned}`,
    `  🚫 Odfiltrowano: ${stats.filtered}`,
    `  💰 Zaniżona cena: ${stats.underpriced}`,
    `  🧠 Analiza AI: ${stats.aiAnalyzed}`,
    `  📩 Powiadomień: ${stats.notified}`,
    `  ❌ Błędów: ${stats.errors}`,
    `  📋 W kolejce AI: ${aiQueueCount}`,
    ``,
    `🔒 Limit dzienny AI: ${botState.daily.aiCalls}/${settings.dailyAiLimit} (${dailyPct}%)`,
    dailyPct >= 80 ? `⚠️ UWAGA: Zbliżasz się do dziennego limitu!` : ``,
  ].filter(Boolean).join("\n");
}
