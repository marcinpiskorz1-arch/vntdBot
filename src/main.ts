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
  { searchText: "nike" },
  { searchText: "jordan" },
  { searchText: "adidas" },
  { searchText: "new balance" },
  { searchText: "under armour" },
  { searchText: "asics" },
  { searchText: "vans" },
  // Outdoor / góry
  { searchText: "la sportiva" },
  { searchText: "salewa" },
  { searchText: "salomon" },
  { searchText: "mammut" },
  { searchText: "arc'teryx" },
  { searchText: "scarpa" },
  { searchText: "norrøna" },
  { searchText: "haglöfs" },
  { searchText: "rab", categoryIds: [5] },  // only clothing — avoid random matches
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
  { searchText: "bape" },
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
  { searchText: "fox racing", categoryIds: [5] },  // only clothing — avoid animals
  { searchText: "dainese" },
  // Inne
  { searchText: "save the duck" },
  // Technologie / materiały premium
  { searchText: "gore-tex" },
  { searchText: "goretex" },
  { searchText: "windstopper" },
  { searchText: "pertex" },
  { searchText: "primaloft" },
  { searchText: "cordura" },
  { searchText: "vibram" },
  { searchText: "polartec" },
  // Premium / luxury resell
  { searchText: "moncler" },
  { searchText: "canada goose" },
  { searchText: "off-white" },
  { searchText: "balenciaga" },
  { searchText: "burberry" },
  { searchText: "barbour" },
  // Tier 2 resell
  { searchText: "columbia" },
  { searchText: "converse" },
  { searchText: "on running" },
  // Skate
  { searchText: "santa cruz" },
  // Customize: add your own queries here
];

// ============================================================
// Pipeline: Scraper → Pricing → AI Analyst → Decision → Telegram
// ============================================================
let isRunning = false;

// Queue for underpriced items that didn't fit in the AI limit
let aiQueue: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]> = [];

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

    let underpriced: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]> = [];

    if (newItems.length > 0) {
      logger.info({ count: newItems.length }, "📦 New items found");

      // Filter: minimum price (below 20 PLN = no profit after shipping)
      const MIN_PRICE = 20;
      const priceFiltered = newItems.filter(i => i.price >= MIN_PRICE);

      // Filter: skip children's items
      const KIDS_KEYWORDS = /\b(dziec|kids?|enfant|copii|barn|kinder|junior|bébé|bebe|niemowl|maluch|dziewczyn.*lat|ch[łl]op.*lat|rozmiar \d{2,3} cm)\b/i;
      const filtered = priceFiltered.filter(i => {
        const text = `${i.title} ${i.description} ${i.size}`;
        return !KIDS_KEYWORDS.test(text);
      });

      // Filter: skip items in poor condition
      const BAD_CONDITION = /zadowalaj|satisf|słaby|poor|accep/i;
      const conditionFiltered = filtered.filter(i => !BAD_CONDITION.test(i.condition));

      if (conditionFiltered.length < newItems.length) {
        logger.info({
          removed: newItems.length - conditionFiltered.length,
          priceTooLow: newItems.length - priceFiltered.length,
          kids: priceFiltered.length - filtered.length,
          badCondition: filtered.length - conditionFiltered.length,
        }, "🚫 Filtered out cheap/kids/bad-condition items");
      }

      if (conditionFiltered.length > 0) {
        // 2. PRICING — evaluate each item
        const evaluated = pricing.evaluateAll(conditionFiltered);
        underpriced = evaluated.filter(([, signal]) => signal.isUnderpriced);

        logger.info(
          { total: evaluated.length, underpriced: underpriced.length },
          "💰 Price filtering done"
        );
      }
    }

    // Merge with queued items from previous cycles
    const combined = [...aiQueue, ...underpriced];
    aiQueue = []; // clear queue

    if (combined.length === 0) {
      if (newItems.length === 0) logger.info("No new items found this cycle");
      return;
    }

    // 3. AI ANALYST — analyze underpriced items (max 200 per cycle)
    const MAX_AI_PER_CYCLE = 200;
    const toAnalyze = combined.slice(0, MAX_AI_PER_CYCLE);
    if (combined.length > MAX_AI_PER_CYCLE) {
      aiQueue = combined.slice(MAX_AI_PER_CYCLE);
      logger.info({ queued: aiQueue.length, total: combined.length }, "⏩ AI limit reached, rest queued for next cycle");
    }
    logger.info({ count: toAnalyze.length, queued: aiQueue.length }, "🧠 Sending to Gemini...");
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

    // Log when items were analyzed but none passed threshold (no Telegram spam)
    if (notifiedCount === 0 && analyzed.length > 0) {
      logger.info({ scanned: newItems.length, analyzed: analyzed.length }, "No deals this cycle");
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

  // Heartbeat every 30 minutes
  cron.schedule("*/30 * * * *", () => {
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
