import { settings } from "./settings.js";
import { botState } from "./bot-state.js";
import type { ProxyPoolStats } from "./agents/scraper/proxy-pool.js";

interface HeartbeatData {
  uptime: number;
  proxyStats?: ProxyPoolStats;
  dcActive?: number;
  dcTotal?: number;
  resActive?: number;
  resTotal?: number;
}

/** Build the hourly heartbeat Telegram message */
export function buildHeartbeatMessage({ uptime, proxyStats, dcActive, dcTotal, resActive, resTotal }: HeartbeatData): string {
  const stats = botState.stats;
  const aiOn = settings.aiEnabled;

  const lines = [
    `💓 Heartbeat — ${new Date().toLocaleTimeString("pl-PL")}`,
    ``,
    settings.paused ? `⏸️ BOT WSTRZYMANY` : `▶️ Aktywny`,
    `🧮 Scoring: ${aiOn ? "reguły + AI photo verify" : "rule-based"}`,
    ``,
    `📊 Od ostatniego raportu (${uptime} min):`,
    `  🔄 Cykli: ${stats.cycles}`,
    `  🔍 Sprawdzono ofert: ${stats.scanned}`,
    `  🚫 Odfiltrowano: ${stats.filtered}`,
    `  💰 Zaniżona cena: ${stats.underpriced}`,
    `  🧮 Ocenionych: ${stats.aiAnalyzed}`,
    `  📩 Powiadomień: ${stats.notified}`,
    `  ❌ Błędów: ${stats.errors}`,
  ];

  if (proxyStats && dcTotal != null && dcTotal > 0) {
    lines.push(``);
    lines.push(`🏢 DC proxy: ${dcActive}/${dcTotal} aktywnych`);
    lines.push(`  📡 Requestów: ${proxyStats.dcRequests}`);
    if (proxyStats.dcErrors > 0) lines.push(`  ⚠️ Błędów: ${proxyStats.dcErrors}`);
  }

  if (proxyStats && resTotal != null && resTotal > 0) {
    lines.push(``);
    lines.push(`🏠 Residential proxy: ${resActive}/${resTotal} aktywnych`);
    lines.push(`  📡 Requestów: ${proxyStats.resRequests}`);
    if (proxyStats.resErrors > 0) lines.push(`  ⚠️ Błędów: ${proxyStats.resErrors}`);
  }

  if (aiOn) {
    const dailyPct = settings.dailyAiLimit > 0
      ? Math.round(botState.daily.aiCalls / settings.dailyAiLimit * 100)
      : 0;
    lines.push(``);
    lines.push(`📸 AI photo verify: ${botState.daily.aiCalls}/${settings.dailyAiLimit} (${dailyPct}%)`);
    if (dailyPct >= 80) lines.push(`⚠️ UWAGA: Zbliżasz się do dziennego limitu!`);
  }

  return lines.filter(Boolean).join("\n");
}
