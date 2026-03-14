import cron from "node-cron";
import { config } from "./config.js";
import { stmts } from "./database.js";
import { logger } from "./logger.js";
import type { ScanConfig } from "./types.js";

import { ScraperAgent } from "./agents/scraper/index.js";
import { OlxScraperAgent } from "./agents/scraper-olx/index.js";
import { PricingAgent } from "./agents/pricing/index.js";
import { AiAnalystAgent } from "./agents/ai-analyst/index.js";
import { DecisionAgent } from "./agents/decision/index.js";
import { TelegramAgent } from "./agents/telegram/index.js";

// ============================================================
// Initialize agents
// ============================================================
const scraper = new ScraperAgent();
const olxScraper = new OlxScraperAgent();
const pricing = new PricingAgent();
const aiAnalyst = new AiAnalystAgent();
const decision = new DecisionAgent();
const telegram = new TelegramAgent();

// ============================================================
// Define what to scan
// ============================================================
const scanConfigs: ScanConfig[] = [
  // Sneakersy — marki
  { searchText: "nike" },
  { searchText: "jordan" },
  { searchText: "adidas" },
  { searchText: "new balance" },
  { searchText: "under armour" },
  { searchText: "asics" },
  { searchText: "vans" },
  // Jordan — modele (priority: skanowane co cykl)
  { searchText: "jordan 1", priority: true },
  { searchText: "jordan 3", priority: true },
  { searchText: "jordan 4", priority: true },
  { searchText: "jordan 5", priority: true },
  { searchText: "jordan 11", priority: true },
  // New Balance — modele hype
  { searchText: "new balance 550", priority: true },
  { searchText: "new balance 574", priority: true },
  { searchText: "new balance 990", priority: true },
  { searchText: "new balance 2002r", priority: true },
  { searchText: "new balance 530", priority: true },
  // Asics — modele
  { searchText: "asics gel lyte", priority: true },
  { searchText: "asics gel kayano", priority: true },
  // Nike — popularne modele (priority: skanowane co cykl)
  { searchText: "nike air max", priority: true },
  { searchText: "nike dunk", priority: true },
  { searchText: "nike blazer", priority: true },
  { searchText: "nike metcon", priority: true },
  { searchText: "nike air force", priority: true },
  { searchText: "nike vapormax", priority: true },
  { searchText: "nike pegasus", priority: true },
  { searchText: "nike acg", priority: true },
  { searchText: "nike tech fleece", priority: true },
  { searchText: "nike sb", priority: true },
  // Adidas — popularne modele
  { searchText: "adidas samba", priority: true },
  { searchText: "adidas gazelle", priority: true },
  { searchText: "adidas superstar", priority: true },
  { searchText: "adidas stan smith", priority: true },
  { searchText: "adidas ultraboost", priority: true },
  { searchText: "adidas nmd", priority: true },
  { searchText: "adidas yeezy", priority: true },
  { searchText: "adidas spezial", priority: true },
  { searchText: "adidas campus", priority: true },
  { searchText: "adidas forum", priority: true },
  { searchText: "adidas terrex", priority: true },
  // Outdoor / góry
  { searchText: "la sportiva" },
  { searchText: "salewa" },
  { searchText: "salomon" },
  // Salomon — modele hype
  { searchText: "salomon xt-6", priority: true },
  { searchText: "salomon speedcross", priority: true },
  { searchText: "salomon xt-4", priority: true },
  { searchText: "mammut" },
  { searchText: "arc'teryx" },
  // Arc'teryx — modele premium
  { searchText: "arcteryx alpha", priority: true },
  { searchText: "arcteryx beta", priority: true },
  { searchText: "arcteryx atom", priority: true },
  { searchText: "arcteryx cerium", priority: true },
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
  // TNF — modele z wysokim resale
  { searchText: "north face nuptse", priority: true },
  { searchText: "north face 1996", priority: true },
  { searchText: "north face denali", priority: true },
  { searchText: "patagonia" },
  // Patagonia — modele
  { searchText: "patagonia retro-x", priority: true },
  { searchText: "patagonia nano puff", priority: true },
  { searchText: "fjällräven" },
  { searchText: "stone island" },
  { searchText: "nervous" },
  { searchText: "carhartt" },
  { searchText: "dickies" },
  { searchText: "supreme" },
  { searchText: "supreme box logo", priority: true },
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
  { searchText: "converse chuck 70", priority: true },
  { searchText: "on running" },
  { searchText: "on cloudmonster", priority: true },
  // Skate
  { searchText: "santa cruz" },

  // ============================================================
  // High ROI (shipping-friendly) — Electronics + Collectibles + Premium small goods
  // ============================================================

  // Audio / wearables
  { searchText: "airpods", priority: true },
  { searchText: "sony wh-1000xm", priority: true },
  { searchText: "bose qc", priority: true },
  { searchText: "jbl" },
  { searchText: "garmin fenix", priority: true },
  { searchText: "garmin forerunner", priority: true },
  { searchText: "apple watch", priority: true },
  { searchText: "g-shock", priority: true },

  // Small tech / gaming peripherals
  { searchText: "kindle" },
  { searchText: "nintendo switch", priority: true },
  { searchText: "joy-con" },
  { searchText: "dualshock" },
  { searchText: "dualsense" },
  { searchText: "logitech mx master" },
  { searchText: "keychron" },

  // Collectibles / hobby
  { searchText: "lego technic", priority: true },
  { searchText: "pokemon karta", priority: true },
  { searchText: "mtg karta" },
  { searchText: "funko pop" },
  { searchText: "warhammer" },

  // Premium accessories
  { searchText: "ray-ban", priority: true },
  { searchText: "michael kors" },
  { searchText: "seiko", priority: true },
  { searchText: "casio edifice" },
  { searchText: "orient zegarek" },

  // Outdoor accessories (małe, wysyłkowe)
  { searchText: "petzl" },
  { searchText: "black diamond" },
  { searchText: "leatherman" },
  { searchText: "nalgene" },
  { searchText: "camelbak" },
];

// OLX uses the same scan configs — reuse full brand list
const olxScanConfigs: ScanConfig[] = scanConfigs
  // Strip Vinted-specific options (categoryIds/brandIds don't apply to OLX API)
  .map(({ searchText }) => ({ searchText }));

// Priority configs (hype models) = scanned every cycle
// Standard configs (generic brands) = scanned every other cycle
const priorityConfigs = scanConfigs.filter(c => c.priority);
const standardConfigs = scanConfigs.filter(c => !c.priority);
const olxPriorityConfigs = olxScanConfigs.filter((_, i) => scanConfigs[i]?.priority);
const olxStandardConfigs = olxScanConfigs.filter((_, i) => !scanConfigs[i]?.priority);

// ============================================================
// Pipeline: Scraper → Pricing → AI Analyst → Decision → Telegram
// ============================================================
let isRunning = false;
let cycleCount = 0; // used to alternate priority/standard scans

// Queue for underpriced items that didn't fit in the AI limit
let aiQueue: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]> = [];

// Cumulative stats between heartbeats
const stats = {
  cycles: 0,
  scanned: 0,
  filtered: 0,
  underpriced: 0,
  aiAnalyzed: 0,
  notified: 0,
  errors: 0,
  startedAt: Date.now(),
  reset() {
    this.cycles = 0;
    this.scanned = 0;
    this.filtered = 0;
    this.underpriced = 0;
    this.aiAnalyzed = 0;
    this.notified = 0;
    this.errors = 0;
    this.startedAt = Date.now();
  },
};

async function runPipeline(): Promise<void> {
  if (isRunning) {
    logger.warn("Pipeline already running, skipping this cycle");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // 1. SCRAPER — fetch new items from Vinted + OLX
    // Priority (hype models) every cycle, standard (generic brands) every other cycle
    const isFullCycle = cycleCount % 2 === 0;
    const vintedToScan = isFullCycle ? scanConfigs : priorityConfigs;
    const olxToScan = isFullCycle ? olxScanConfigs : olxPriorityConfigs;
    logger.info({ cycle: cycleCount, full: isFullCycle, vintedQueries: vintedToScan.length, olxQueries: olxToScan.length }, "🔍 Pipeline: Starting scan...");
    const vintedItems = await scraper.scan(vintedToScan);
    const olxItems = await olxScraper.scan(olxToScan);
    const newItems = [...vintedItems, ...olxItems];
    cycleCount++;

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

      // Filter: skip beanies / hats / czapki (low-value accessories)
      const BEANIE_KEYWORDS = /\b(beanie|czapk[aię]|bonnet|m[üu]tze|hat|kapelusz|beret)\b/i;
      const noHats = filtered.filter(i => {
        const text = `${i.title} ${i.description} ${i.category}`;
        return !BEANIE_KEYWORDS.test(text);
      });

      // Filter: skip items in poor condition
      const BAD_CONDITION = /zadowalaj|satisf|słaby|poor|accep/i;
      const conditionFiltered = noHats.filter(i => !BAD_CONDITION.test(i.condition));

      // Filter: skip pickup-only items (OLX especially — no way to ship)
      const PICKUP_ONLY = /\b(tylko odbio|odbi[oó]r osobi|nie wysy[łl]am|osobisty odbio)\b/i;
      const shippable = conditionFiltered.filter(i => {
        const text = `${i.title} ${i.description}`;
        return !PICKUP_ONLY.test(text);
      });

      if (shippable.length < newItems.length) {
        const removedCount = newItems.length - shippable.length;
        stats.filtered += removedCount;
        logger.info({
          removed: removedCount,
          priceTooLow: newItems.length - priceFiltered.length,
          kids: priceFiltered.length - filtered.length,
          hats: filtered.length - noHats.length,
          badCondition: noHats.length - conditionFiltered.length,
          pickupOnly: conditionFiltered.length - shippable.length,
        }, "🚫 Filtered out cheap/kids/hats/bad-condition/pickup-only items");
      }

      if (shippable.length > 0) {
        // 2. PRICING — evaluate each item
        const evaluated = pricing.evaluateAll(shippable);
        underpriced = evaluated.filter(([, signal]) => signal.isUnderpriced);
        stats.underpriced += underpriced.length;

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

    // Update cumulative stats
    stats.cycles++;
    stats.scanned += newItems.length;
    stats.aiAnalyzed += analyzed.length;
    stats.notified += notifiedCount;

    // Log when items were analyzed but none passed threshold (no Telegram spam)
    if (notifiedCount === 0 && analyzed.length > 0) {
      logger.info({ scanned: newItems.length, analyzed: analyzed.length }, "No deals this cycle");
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      {
        newItems: newItems.length,
        underpriced: underpriced.length,
        notified: notifiedCount,
        elapsed: `${elapsed}s`,
      },
      "✅ Pipeline cycle complete"
    );
  } catch (err) {
    stats.errors++;
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

  // Heartbeat every hour with stats summary
  cron.schedule("0 * * * *", () => {
    const uptime = Math.round((Date.now() - stats.startedAt) / 60000);
    const msg = [
      `💓 Heartbeat — ${new Date().toLocaleTimeString("pl-PL")}`,
      ``,
      `📊 Od ostatniego raportu (${uptime} min):`,
      `  🔄 Cykli: ${stats.cycles}`,
      `  🔍 Sprawdzono ofert: ${stats.scanned}`,
      `  🚫 Odfiltrowano: ${stats.filtered}`,
      `  💰 Zaniżona cena: ${stats.underpriced}`,
      `  🧠 Analiza AI: ${stats.aiAnalyzed}`,
      `  📩 Powiadomień: ${stats.notified}`,
      `  ❌ Błędów: ${stats.errors}`,
      `  📋 W kolejce AI: ${aiQueue.length}`,
    ].join("\n");
    telegram.sendMessage(msg).catch(() => {});
    stmts.insertHeartbeat.run({
      cycles: stats.cycles,
      scanned: stats.scanned,
      filtered: stats.filtered,
      underpriced: stats.underpriced,
      ai_analyzed: stats.aiAnalyzed,
      notified: stats.notified,
      errors: stats.errors,
      ai_queue: aiQueue.length,
      period_min: uptime,
    });
    stats.reset();
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
