import cron from "node-cron";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { ScanConfig } from "./types.js";

import { ScraperAgent } from "./agents/scraper/index.js";
import { PricingAgent } from "./agents/pricing/index.js";
import { AiAnalystAgent } from "./agents/ai-analyst/index.js";
import { DecisionAgent } from "./agents/decision/index.js";
import { TelegramAgent } from "./agents/telegram/index.js";

// ============================================================
// Initialize agents
// ============================================================
const scraper = new ScraperAgent();
const pricing = new PricingAgent();
const aiAnalyst = new AiAnalystAgent();
const decision = new DecisionAgent();
const telegram = new TelegramAgent();

// ============================================================
// Define what to scan
// ============================================================
const scanConfigs: ScanConfig[] = [
  // Buty
  { categoryIds: [1242], searchText: "nike air max" },
  { categoryIds: [1242], searchText: "jordan" },
  { categoryIds: [1242], searchText: "new balance 550" },
  // Elektronika
  { categoryIds: [2678], searchText: "airpods" },
  { categoryIds: [2678], searchText: "iphone" },
  // Customize: add your own queries here
];

// ============================================================
// Pipeline: Scraper → Pricing → AI Analyst → Decision → Telegram
// ============================================================
let isRunning = false;

async function runPipeline(): Promise<void> {
  if (isRunning) {
    logger.warn("Pipeline already running, skipping this cycle");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // 1. SCRAPER — fetch new items
    logger.info("🔍 Pipeline: Starting scan...");
    const newItems = await scraper.scan(scanConfigs);

    if (newItems.length === 0) {
      logger.info("No new items found this cycle");
      return;
    }

    logger.info({ count: newItems.length }, "📦 New items found");

    // 2. PRICING — evaluate each item
    const evaluated = pricing.evaluateAll(newItems);

    // Filter: only underpriced items go to AI
    const underpriced = evaluated.filter(([, signal]) => signal.isUnderpriced);

    logger.info(
      { total: evaluated.length, underpriced: underpriced.length },
      "💰 Price filtering done"
    );

    if (underpriced.length === 0) return;

    // 3. AI ANALYST — analyze underpriced items only
    logger.info({ count: underpriced.length }, "🧠 Sending to Gemini...");
    const analyzed = await aiAnalyst.analyzeAll(underpriced);

    // 4. DECISION — score and decide
    for (const [item, signal, ai] of analyzed) {
      const result = decision.decide(item, signal, ai);

      // 5. TELEGRAM — notify if above threshold
      if (result.level !== "ignore") {
        await telegram.notify(result);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      {
        newItems: newItems.length,
        underpriced: underpriced.length,
        notified: analyzed.filter(
          ([, , ai]) => ai.resalePotential >= 0 // just counting
        ).length,
        elapsed: `${elapsed}s`,
      },
      "✅ Pipeline cycle complete"
    );
  } catch (err) {
    logger.error({ err }, "❌ Pipeline error");
    await telegram
      .sendMessage(`⚠️ Pipeline error: ${err instanceof Error ? err.message : "unknown"}`)
      .catch(() => {});
  } finally {
    isRunning = false;
  }
}

// ============================================================
// Scheduler
// ============================================================
async function main(): Promise<void> {
  logger.info("🤖 VintedBot starting...");
  logger.info({
    scanConfigs: scanConfigs.length,
    intervalMs: config.scanIntervalMs,
    threshold: config.dealThreshold,
    proxies: config.proxyUrls.length,
  }, "Configuration loaded");

  // Start Telegram bot (listens for commands + button callbacks)
  await telegram.start();
  await telegram.sendMessage("🤖 VintedBot uruchomiony! Rozpoczynam skanowanie...");

  // Run first pipeline immediately
  await runPipeline();

  // Schedule recurring scans with jitter
  const intervalSec = Math.round(config.scanIntervalMs / 1000);
  const cronExpr = `*/${intervalSec} * * * * *`; // every N seconds

  // node-cron doesn't support seconds by default — use setInterval with jitter instead
  const scheduleNext = () => {
    const jitter = Math.random() * 15000; // 0-15s random jitter
    const delay = config.scanIntervalMs + jitter;
    setTimeout(async () => {
      await runPipeline();
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  // Heartbeat every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    telegram
      .sendMessage(`💓 Heartbeat — ${new Date().toLocaleTimeString("pl-PL")}`)
      .catch(() => {});
  });

  logger.info(`⏰ Scheduled: scan every ~${intervalSec}s + jitter, heartbeat every 5min`);
}

// ============================================================
// Graceful shutdown
// ============================================================
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await telegram.sendMessage("🛑 VintedBot wyłączany...");
  await telegram.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await telegram.stop();
  process.exit(0);
});

// ============================================================
// Start
// ============================================================
main().catch((err) => {
  logger.error({ err }, "Fatal error");
  process.exit(1);
});
