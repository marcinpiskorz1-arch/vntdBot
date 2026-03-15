import cron from "node-cron";
import { config } from "./config.js";
import { stmts } from "./database.js";
import { logger } from "./logger.js";
import { settings } from "./settings.js";
import { botState } from "./bot-state.js";
import { scanConfigs } from "./data/scan-configs.js";
import { filterItems } from "./filters.js";
import { buildHeartbeatMessage } from "./heartbeat.js";
import type { ScanConfig } from "./types.js";

import { ScraperAgent } from "./agents/scraper/index.js";
import { checkItemAvailable } from "./agents/scraper/vinted-api.js";
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
// Define what to scan — loaded from src/data/scan-configs.ts
// ============================================================

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
      discount_pct: signal.discountPct,
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

      // Run all filters (price, kids, hats, condition, pickup)
      const { passed: shippable, removed: removedCount, breakdown } = filterItems(newItems, settings.minPrice);

      if (removedCount > 0) {
        stats.filtered += removedCount;
        logger.info({ removed: removedCount, ...breakdown }, "🚫 Filtered out cheap/kids/hats/bad-condition/pickup-only items");
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
      // ⚡ INSTANT ALERTS — ultra-cheap items, no AI needed
      const INSTANT_DISCOUNT = settings.instantThreshold; // default 70%
      const INSTANT_MIN_PRICE = 50;
      const INSTANT_MIN_SAMPLE = 15;

      const instantItems = underpriced.filter(([item, signal]) =>
        signal.discountPct >= INSTANT_DISCOUNT &&
        signal.sampleSize >= INSTANT_MIN_SAMPLE &&
        item.price >= INSTANT_MIN_PRICE
      );

      if (instantItems.length > 0) {
        logger.info({ count: instantItems.length, threshold: INSTANT_DISCOUNT }, "⚡ Instant alerts triggered");
        for (const [item, signal] of instantItems) {
          await telegram.sendInstantAlert({
            vintedId: item.vintedId,
            title: item.title,
            brand: item.brand,
            price: item.price,
            medianPrice: signal.medianPrice,
            discountPct: signal.discountPct,
            sampleSize: signal.sampleSize,
            url: item.url,
            photoUrl: item.photoUrls?.[0],
          });
        }
      }

      // All underpriced items still go to AI queue for full analysis
      enqueueToAi(underpriced);
    }

    // Dequeue from persistent queue (includes items from previous cycles that survived restarts)
    const MAX_AI_PER_CYCLE = settings.aiLimit;
    const queued = dequeueFromAi(MAX_AI_PER_CYCLE);

    if (queued.length === 0) {
      if (newItems.length === 0) logger.info("No new items found this cycle");
      return;
    }

    // Check daily AI limit before spending tokens
    const today = new Date().toISOString().slice(0, 10);
    if (botState.daily.date !== today) {
      botState.daily.aiCalls = 0;
      botState.daily.date = today;
    }
    if (botState.daily.aiCalls >= settings.dailyAiLimit) {
      logger.warn({ dailyCalls: botState.daily.aiCalls, limit: settings.dailyAiLimit }, "🛑 Daily AI limit reached — skipping AI this cycle");
      // Send one-time alert (not every cycle)
      if (!botState._dailyLimitAlerted) {
        botState._dailyLimitAlerted = true;
        await telegram.sendMessage(`🛑 Dzienny limit AI osiągnięty (${botState.daily.aiCalls}/${settings.dailyAiLimit}).\nBot nadal skanuje oferty, ale AI analiza wstrzymana do jutra.\nZmień limit: /set daily_ai_limit <wartość>`).catch(() => {});
      }
      return;
    }
    // Reset alert flag when new day starts
    if (botState._dailyLimitAlerted && botState.daily.aiCalls === 0) {
      botState._dailyLimitAlerted = false;
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
    const aiQueueCount = getAiQueueCount();
    const msg = buildHeartbeatMessage({ uptime, aiQueueCount });
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

  // Check favorites sold status every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      const favorites = stmts.getActiveFavoriteUrls.all() as Array<{
        vinted_id: string; url: string; title: string; price: number; added_at: string;
      }>;
      if (favorites.length === 0) return;

      const session = await scraper.getSession();
      let soldCount = 0;

      for (const fav of favorites) {
        const available = await checkItemAvailable(fav.url, session);
        if (!available) {
          stmts.markFavoriteSold.run({ vinted_id: fav.vinted_id });
          soldCount++;

          const hoursAgo = Math.round((Date.now() - new Date(fav.added_at).getTime()) / 3600000);
          await telegram.sendMessage(
            `⚡ <b>Ulubione — SPRZEDANE!</b>\n\n` +
            `${fav.title}\n` +
            `💰 ${fav.price} PLN\n` +
            `⏱️ Sprzedane po ${hoursAgo}h od dodania do ulubionych`
          ).catch(() => {});
        }
        // Delay between checks
        await new Promise(r => setTimeout(r, 1500));
      }

      if (soldCount > 0) {
        logger.info({ sold: soldCount, checked: favorites.length }, "❤️ Favorites sold check complete");
      }
    } catch (err) {
      logger.error({ err }, "Failed to check favorites sold status");
    }
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
