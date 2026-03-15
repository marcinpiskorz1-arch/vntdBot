import { stmts } from "./database.js";
import { config } from "./config.js";

// In-memory cache — synced with DB
const cache = new Map<string, string>();

// Load all settings from DB into cache on startup
function loadFromDb(): void {
  const rows = stmts.getAllSettings.all() as { key: string; value: string }[];
  for (const { key, value } of rows) {
    cache.set(key, value);
  }
}
loadFromDb();

function get(key: string): string | undefined {
  return cache.get(key);
}

function set(key: string, value: string): void {
  cache.set(key, value);
  stmts.setSetting.run({ key, value });
}

function getNumber(key: string, fallback: number): number {
  const v = cache.get(key);
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function getBool(key: string, fallback: boolean): boolean {
  const v = cache.get(key);
  if (v === undefined) return fallback;
  return v === "1" || v === "true";
}

/** All bot settings — reads from DB cache, falls back to config defaults */
export const settings = {
  get,
  set,
  getNumber,
  getBool,

  get paused(): boolean {
    return getBool("paused", false);
  },
  set paused(v: boolean) {
    set("paused", v ? "1" : "0");
  },

  get notifyThreshold(): number {
    return getNumber("notify_threshold", config.notifyThreshold);
  },
  get hotThreshold(): number {
    return getNumber("hot_threshold", config.hotThreshold);
  },
  get hotMinProfit(): number {
    return getNumber("hot_min_profit", config.hotMinProfit);
  },
  get minPrice(): number {
    return getNumber("min_price", 20);
  },
  get aiLimit(): number {
    return getNumber("ai_limit", 100);
  },

  /** Return all current values (for /status display) */
  dump(): Record<string, string | number | boolean> {
    return {
      paused: getBool("paused", false),
      notify_threshold: getNumber("notify_threshold", config.notifyThreshold),
      hot_threshold: getNumber("hot_threshold", config.hotThreshold),
      hot_min_profit: getNumber("hot_min_profit", config.hotMinProfit),
      min_price: getNumber("min_price", 20),
      ai_limit: getNumber("ai_limit", 100),
    };
  },

  /** List of valid setting keys for /set command */
  VALID_KEYS: ["notify_threshold", "hot_threshold", "hot_min_profit", "min_price", "ai_limit"] as const,
};
