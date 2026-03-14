import cron from "node-cron";
import { config } from "./config.js";
import { stmts } from "./database.js";
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
  // Sneakersy
  { searchText: "nike air max" },
  { searchText: "jordan" },
  { searchText: "new balance" },
  { searchText: "under armour" },
  { searchText: "asics" },
  // Outdoor / góry
  { searchText: "la sportiva" },
  { searchText: "salewa" },
  { searchText: "salomon" },
  { searchText: "mammut" },
  { searchText: "arc'teryx" },
  { searchText: "scarpa" },
  { searchText: "norrøna" },
  { searchText: "haglöfs" },
  { searchText: "rab" },
  { searchText: "millet" },
  { searchText: "meindl" },
  { searchText: "lowa" },
  { searchText: "osprey" },
  // Streetwear / hype
  { searchText: "the north face" },
  { searchText: "patagonia" },
  { searchText: "fjällräven" },
  { searchText: "stone island" },
  { searchText: "nervous" },
  { searchText: "carhartt" },
  { searchText: "dickies" },
  { searchText: "supreme" },
  { searchText: "stüssy" },
  { searchText: "napapijri" },
  { searchText: "ralph lauren" },
  { searchText: "tommy hilfiger" },
  // Workwear / vintage
  { searchText: "levi's" },
  { searchText: "wrangler" },
  // Snow / board
  { searchText: "volcom" },
  { searchText: "quiksilver" },
  { searchText: "burton" },
  { searchText: "dc shoes" },
  { searchText: "oakley" },
  { searchText: "helly hansen" },
  { searchText: "dakine" },
  // Moto / sport
  { searchText: "alpinestars" },
  { searchText: "fox racing" },
  // Inne
  { searchText: "save the duck" },
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

    // Filter: minimum price (below 30 PLN = no profit after shipping)
    const MIN_PRICE = 30;
    const priceFiltered = newItems.filter(i => i.price >= MIN_PRICE);

    // Filter: skip children's items
    const KIDS_KEYWORDS = /\b(dziec|kids?|enfant|copii|barn|kinder|junior|bébé|bebe|niemowl|maluch|dziewczyn.*lat|ch[łl]op.*lat|rozmiar \d{2,3} cm)\b/i;
    const filtered = priceFiltered.filter(i => {
      const text = `${i.title} ${i.description} ${i.size}`;
      return !KIDS_KEYWORDS.test(text);
    });

    if (filtered.length < newItems.length) {
      logger.info({ removed: newItems.length - filtered.length, priceTooLow: newItems.length - priceFiltered.length }, "🚫 Filtered out cheap/kids items");
    }

    if (filtered.length === 0) return;

    // 2. PRICING — evaluate each item
    const evaluated = pricing.evaluateAll(filtered);

    // Filter: only underpriced items go to AI
    const underpriced = evaluated.filter(([, signal]) => signal.isUnderpriced);

    logger.info(
      { total: evaluated.length, underpriced: underpriced.length },
      "💰 Price filtering done"
    );

    if (underpriced.length === 0) return;

    // 3. AI ANALYST — analyze underpriced items (max 20 per cycle to stay within Gemini free tier)
    const MAX_AI_PER_CYCLE = 20;
    const toAnalyze = underpriced.slice(0, MAX_AI_PER_CYCLE);
    if (underpriced.length > MAX_AI_PER_CYCLE) {
      logger.info({ skipped: underpriced.length - MAX_AI_PER_CYCLE }, "\u23e9 AI limit reached, rest queued for next cycle");
    }
    logger.info({ count: toAnalyze.length }, "\ud83e\udde0 Sending to Gemini...");
    const analyzed = await aiAnalyst.analyzeAll(toAnalyze);

    // 4. DECISION — score and decide
    let notifiedCount = 0;
    for (const [item, signal, ai] of analyzed) {
      const result = decision.decide(item, signal, ai);

      // 5. TELEGRAM — notify if above threshold
      if (result.level !== "ignore") {
        await telegram.notify(result);
        notifiedCount++;
      }
    }

    // Info when items were analyzed but none passed threshold
    if (notifiedCount === 0 && analyzed.length > 0) {
      await telegram.sendMessage(
        `🔍 Przeskanowałem ${newItems.length} ofert, ${analyzed.length} przeanalizowałem — brak okazji. Szukam dalej...`
      ).catch(() => {});
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

  // Cleanup old data every day at 3 AM
  cron.schedule("0 3 * * *", () => {
    const deletedItems = stmts.deleteOldItems.run({ days: 30 });
    const deletedDecisions = stmts.deleteOldDecisions.run({ days: 30 });
    logger.info(
      { deletedItems: deletedItems.changes, deletedDecisions: deletedDecisions.changes },
      "🧹 30-day cleanup complete"
    );
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
