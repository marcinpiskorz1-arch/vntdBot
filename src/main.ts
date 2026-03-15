import cron from "node-cron";
import { config } from "./config.js";
import { stmts } from "./database.js";
import { logger } from "./logger.js";
import { settings } from "./settings.js";
import { botState } from "./bot-state.js";
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
  { searchText: "revolutionrace" },
  { searchText: "hunter boots" },
  { searchText: "timberland" },
  { searchText: "dynafit" },
  { searchText: "merrell" },
  { searchText: "peak performance" },
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
  { searchText: "north face duffel", priority: true },
  { searchText: "patagonia" },
  // Patagonia — modele
  { searchText: "patagonia retro-x", priority: true },
  { searchText: "patagonia nano puff", priority: true },
  { searchText: "patagonia black hole", priority: true },
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

  // Telefony
  { searchText: "iphone 13", priority: true },
  { searchText: "iphone 14", priority: true },
  { searchText: "iphone 15", priority: true },
  { searchText: "iphone 16", priority: true },
  { searchText: "samsung galaxy s23" },
  { searchText: "samsung galaxy s24", priority: true },
  { searchText: "google pixel" },
  { searchText: "xiaomi" },

  // Tablety
  { searchText: "ipad pro", priority: true },
  { searchText: "ipad air", priority: true },
  { searchText: "ipad mini" },

  // Laptopy / komputery
  { searchText: "macbook pro", priority: true },
  { searchText: "macbook air", priority: true },
  { searchText: "thinkpad", priority: true },
  { searchText: "dell xps" },
  { searchText: "surface pro" },
  { searchText: "steam deck", priority: true },
];

// OLX uses the same scan configs — reuse full brand list
const olxScanConfigs: ScanConfig[] = scanConfigs
  // Strip Vinted-specific options (categoryIds/brandIds don't apply to OLX API)
  .map(({ searchText }) => ({ searchText }));

/** Load custom queries from DB and merge with hardcoded configs */
function buildScanLists() {
  const customRows = stmts.getCustomQueries.all() as { search_text: string; priority: number }[];
  const customConfigs: ScanConfig[] = customRows.map(r => ({
    searchText: r.search_text,
    priority: r.priority === 1,
  }));

  const allVinted = [...scanConfigs, ...customConfigs];

  // OLX: all queries (no category filter — OLX API handles relevance via search text)
  const allOlx: ScanConfig[] = [...scanConfigs, ...customConfigs].map(({ searchText }) => ({ searchText }));

  const priority = allVinted.filter(c => c.priority);
  const olxPriority: ScanConfig[] = scanConfigs.filter(c => c.priority).map(({ searchText }) => ({ searchText }));

  // Update botState for /status command
  botState.totalQueries = scanConfigs.length;
  botState.priorityQueries = scanConfigs.filter(c => c.priority).length;
  botState.customQueries = customRows.length;

  return { allVinted, allOlx, priority, olxPriority };
}

// ============================================================
// Pipeline: Scraper → Pricing → AI Analyst → Decision → Telegram
// ============================================================

// Alias for brevity — botState.stats is the shared stats object
const stats = botState.stats;

/** Enqueue items to persistent AI queue (survives restarts) */
function enqueueToAi(items: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]>): void {
  // Cap queue size to prevent unbounded growth (old items become stale anyway)
  const MAX_QUEUE = 100;
  const currentSize = getAiQueueCount();
  if (currentSize >= MAX_QUEUE) {
    logger.warn({ currentSize, dropped: items.length }, "AI queue full, dropping new items");
    return;
  }
  const spaceLeft = MAX_QUEUE - currentSize;
  const toEnqueue = items.slice(0, spaceLeft);
  for (const [item, signal] of toEnqueue) {
    stmts.enqueueAi.run({
      vinted_id: item.vintedId,
      item_json: JSON.stringify(item),
      signal_json: JSON.stringify(signal),
    });
  }
}

/** Dequeue items from persistent AI queue */
function dequeueFromAi(limit: number): Array<[import("./types.js").RawItem, import("./types.js").PriceSignal, number]> {
  const rows = stmts.dequeueAi.all({ limit }) as { id: number; item_json: string; signal_json: string }[];
  return rows.map(r => [JSON.parse(r.item_json), JSON.parse(r.signal_json), r.id]);
}

function getAiQueueCount(): number {
  return (stmts.countAiQueue.get() as { count: number }).count;
}

function resetStats() {
  stats.cycles = 0;
  stats.scanned = 0;
  stats.filtered = 0;
  stats.underpriced = 0;
  stats.aiAnalyzed = 0;
  stats.notified = 0;
  stats.errors = 0;
}

async function runPipeline(): Promise<void> {
  // Check if paused via Telegram /pause command
  if (settings.paused) {
    logger.info("⏸️ Bot paused, skipping cycle");
    return;
  }

  if (botState.isRunning) {
    logger.warn("Pipeline already running, skipping this cycle");
    return;
  }

  botState.isRunning = true;
  const startTime = Date.now();

  try {
    // Reload custom queries from DB each cycle (picks up Telegram /queries_add changes)
    const lists = buildScanLists();

    // 1. SCRAPER — fetch new items from Vinted + OLX
    // Priority (hype models) every cycle, standard (generic brands) every other cycle
    const isFullCycle = botState.cycleCount % 2 === 0;
    const vintedToScan = isFullCycle ? lists.allVinted : lists.priority;
    const olxToScan = isFullCycle ? lists.allOlx : lists.olxPriority;
    logger.info({ cycle: botState.cycleCount, full: isFullCycle, vintedQueries: vintedToScan.length, olxQueries: olxToScan.length }, "🔍 Pipeline: Starting scan...");
    const vintedItems = await scraper.scan(vintedToScan);
    const olxItems = await olxScraper.scan(olxToScan);
    const newItems = [...vintedItems, ...olxItems];
    botState.cycleCount++;

    let underpriced: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]> = [];

    if (newItems.length > 0) {
      logger.info({ count: newItems.length }, "📦 New items found");

      // Filter: minimum price (dynamic — settable via /set min_price)
      const MIN_PRICE = settings.minPrice;
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

    // Enqueue new underpriced items to persistent AI queue
    if (underpriced.length > 0) {
      enqueueToAi(underpriced);
    }

    // Dequeue from persistent queue (includes items from previous cycles that survived restarts)
    const MAX_AI_PER_CYCLE = settings.aiLimit;
    const queued = dequeueFromAi(MAX_AI_PER_CYCLE);

    if (queued.length === 0) {
      if (newItems.length === 0) logger.info("No new items found this cycle");
      return;
    }

    const remainingInQueue = getAiQueueCount();
    if (remainingInQueue > 0) {
      logger.info({ processing: queued.length, remaining: remainingInQueue }, "⏩ AI limit reached, rest stays in persistent queue");
    }
    logger.info({ count: queued.length, queued: remainingInQueue }, "🧠 Sending to Gemini...");
    const toAnalyze: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal]> = queued.map(([item, signal]) => [item, signal]);
    const analyzed = await aiAnalyst.analyzeAll(toAnalyze);

    // Remove successfully analyzed items from persistent queue
    for (const [,, dbId] of queued) {
      stmts.removeFromAiQueue.run({ id: dbId });
    }

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
    botState.isRunning = false;
    botState.aiQueueLength = getAiQueueCount();
  }
}

// ============================================================
// Scheduler
// ============================================================
async function main(): Promise<void> {
  logger.info("🤖 VintedBot starting...");
  // Initialize query counts for /status
  const initialLists = buildScanLists();

  logger.info({
    scanConfigs: scanConfigs.length,
    customQueries: botState.customQueries,
    intervalMs: config.scanIntervalMs,
    threshold: config.dealThreshold,
    proxies: config.proxyUrls.length,
  }, "Configuration loaded");

  // Check for items left in persistent AI queue from previous run
  const pendingAi = getAiQueueCount();
  if (pendingAi > 0) {
    logger.info({ pending: pendingAi }, "📋 Found items in persistent AI queue from previous run — will process this cycle");
  }
  botState.aiQueueLength = pendingAi;

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
  let lastHeartbeat = Date.now();
  cron.schedule("0 * * * *", () => {
    const uptime = Math.round((Date.now() - lastHeartbeat) / 60000);
    const msg = [
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
      `  📋 W kolejce AI: ${getAiQueueCount()}`,
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
      ai_queue: getAiQueueCount(),
      period_min: uptime,
    });
    resetStats();
    lastHeartbeat = Date.now();
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
