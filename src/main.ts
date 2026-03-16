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
import { escapeHtml } from "./agents/telegram/formatters.js";
import { needsPhotoVerification, getBrandTier } from "./agents/decision/rule-scoring.js";
import { classifyItemType, isBrandTypeWorthNotifying } from "./item-classifier.js";

// Item types that should never trigger instant alerts (low resale value)
const LOW_VALUE_TYPES = new Set(["top", "pants", "headwear", "accessory"]);

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

    // Streaming counters — updated by processBatch callback
    let totalNewItems = 0;
    let totalUnderpriced = 0;
    let notifiedCount = 0;
    let analyzedCount = 0;
    const photoVerifyCandidates: Array<[import("./types.js").RawItem, import("./types.js").PriceSignal, import("./types.js").Decision]> = [];

    // Process items immediately as each scan batch arrives
    const processBatch = async (newItems: import("./types.js").RawItem[]): Promise<void> => {
      if (newItems.length === 0) return;
      totalNewItems += newItems.length;

      // FILTER
      const { passed: shippable, removed: removedCount, breakdown } = filterItems(newItems, settings.minPrice);
      if (removedCount > 0) {
        stats.filtered += removedCount;
        logger.info({ removed: removedCount, ...breakdown }, "🚫 Filtered items");
      }
      if (shippable.length === 0) return;

      // PRICING
      const evaluated = pricing.evaluateAll(shippable);
      const underpriced = evaluated.filter(([, signal]) => signal.isUnderpriced);
      stats.underpriced += underpriced.length;
      totalUnderpriced += underpriced.length;

      if (underpriced.length === 0) return;

      // ⚡ INSTANT ALERTS
      const INSTANT_DISCOUNT = settings.instantThreshold;
      const INSTANT_MIN_PRICE = 50;
      const INSTANT_MIN_SAMPLE = 15;
      const instantIds = new Set<string>();
      const instantItems = underpriced.filter(([item, signal]) => {
        const tier = getBrandTier(item.brand).tier;
        const itemType = classifyItemType(item.title);
        return signal.discountPct >= INSTANT_DISCOUNT &&
          signal.sampleSize >= INSTANT_MIN_SAMPLE &&
          item.price >= INSTANT_MIN_PRICE &&
          (tier === "premium" || tier === "mid") &&
          !LOW_VALUE_TYPES.has(itemType) &&
          isBrandTypeWorthNotifying(item.brand, itemType);
      });
      for (const [item, signal] of instantItems) {
        instantIds.add(item.vintedId);
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

      // RULE-BASED SCORING — skip items already sent as instant alerts
      for (const [item, signal] of underpriced) {
        if (instantIds.has(item.vintedId)) continue;

        // Skip items that don't match brand's worthwhile item types
        const itemType = classifyItemType(item.title);
        if (!isBrandTypeWorthNotifying(item.brand, itemType)) continue;

        const result = decision.decideWithRules(item, signal);
        analyzedCount++;
        if (result.level !== "ignore") {
          // Items with vague titles + high score → queue for AI photo verification
          if (settings.aiEnabled && needsPhotoVerification(item.title, result.score)) {
            photoVerifyCandidates.push([item, signal, result]);
          } else {
            await telegram.notify(result);
            notifiedCount++;
          }
        }
      }
    };

    // Run Vinted + OLX in parallel, streaming batches through processBatch
    await Promise.all([
      scraper.scan(vintedToScan, processBatch),
      olxScraper.scan(olxToScan, processBatch),
    ]);
    botState.cycleCount++;

    if (totalUnderpriced > 0) {
      logger.info({
        analyzed: analyzedCount,
        notified: notifiedCount,
        photoVerify: photoVerifyCandidates.length,
      }, "📊 Rule-based scoring done");
    }

    // ============================================================
    // AI photo verification for vague-title items
    // ============================================================
    if (photoVerifyCandidates.length > 0 && settings.aiEnabled) {
      logger.info({ count: photoVerifyCandidates.length }, "📸 Verifying vague-title items with AI photo check...");
      for (const [item, signal, ruleDecision] of photoVerifyCandidates) {
        const verification = await aiAnalyst.verifyWithPhoto(item, signal);
        stats.aiAnalyzed++;
        if (verification.confirmed) {
          // AI confirmed — enrich reasons and notify
          ruleDecision.reasons.push(`📸 AI: ${verification.identifiedModel} — ${verification.reason}`);
          await telegram.notify(ruleDecision);
          notifiedCount++;
          logger.info({ item: item.vintedId, model: verification.identifiedModel }, "✅ AI confirmed deal");
        } else {
          logger.info({ item: item.vintedId, model: verification.identifiedModel, reason: verification.reason }, "❌ AI rejected — junk");
        }
      }
    }

    if (totalNewItems === 0 && analyzedCount === 0) {
      logger.info("No new items found this cycle");
    }

    // Update cumulative stats
    stats.cycles++;
    stats.scanned += totalNewItems;
    stats.aiAnalyzed += analyzedCount;
    stats.notified += notifiedCount;

    // Log when items were analyzed but none passed threshold
    if (notifiedCount === 0 && analyzedCount > 0) {
      logger.info({ scanned: totalNewItems, analyzed: analyzedCount }, "No deals this cycle");
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      {
        newItems: totalNewItems,
        underpriced: totalUnderpriced,
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
    scoring: settings.aiEnabled ? "reguły + AI photo verify" : "rule-based",
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
  let lastHeartbeat = Date.now();
  cron.schedule("0 * * * *", () => {
    const uptime = Math.round((Date.now() - lastHeartbeat) / 60000);
    const msg = buildHeartbeatMessage({ uptime });
    telegram.sendMessage(msg).catch(() => {});
    stmts.insertHeartbeat.run({
      cycles: stats.cycles,
      scanned: stats.scanned,
      filtered: stats.filtered,
      underpriced: stats.underpriced,
      ai_analyzed: stats.aiAnalyzed,
      notified: stats.notified,
      errors: stats.errors,
      ai_queue: 0,
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
            `${escapeHtml(fav.title)}\n` +
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

  logger.info(`⏰ Scheduled: scan every ~${intervalSec}s + jitter, heartbeat hourly`);
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
