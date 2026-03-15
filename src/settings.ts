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
    return getNumber("ai_limit", 20);
  },
  get dailyAiLimit(): number {
    return getNumber("daily_ai_limit", 500);
  },
  get instantThreshold(): number {
    return getNumber("instant_threshold", 70);
  },
  get minProfitToNotify(): number {
    return getNumber("min_profit", 35);
  },

  /** Return all current values (for /status display) */
  dump(): Record<string, string | number | boolean> {
    return {
      paused: getBool("paused", false),
      notify_threshold: getNumber("notify_threshold", config.notifyThreshold),
      hot_threshold: getNumber("hot_threshold", config.hotThreshold),
      hot_min_profit: getNumber("hot_min_profit", config.hotMinProfit),
      min_price: getNumber("min_price", 20),
      ai_limit: getNumber("ai_limit", 20),
      daily_ai_limit: getNumber("daily_ai_limit", 500),
      instant_threshold: getNumber("instant_threshold", 70),
      min_profit: getNumber("min_profit", 35),
    };
  },

  /** List of valid setting keys for /set command */
  VALID_KEYS: ["notify_threshold", "hot_threshold", "hot_min_profit", "min_price", "ai_limit", "daily_ai_limit", "instant_threshold", "min_profit"] as const,

  /** Validation rules: min, max, description, warning */
  RULES: {
    notify_threshold: { min: 3, max: 9.5, desc: "Próg score do powiadomienia", warn: "< 5 = dużo spamu, > 8 = prawie nic nie przejdzie" },
    hot_threshold: { min: 7, max: 10, desc: "Próg score dla HOT deal", warn: "< 8 = za łatwo HOT, powinien być > notify_threshold" },
    hot_min_profit: { min: 10, max: 500, desc: "Min zysk (PLN) dla HOT", warn: "< 30 = HOT za tanio" },
    min_price: { min: 5, max: 200, desc: "Min cena oferty (PLN)", warn: "< 10 = dużo śmieci, > 50 = pominiesz tanie okazje" },
    ai_limit: { min: 5, max: 50, desc: "Max analiz AI / cykl", warn: "> 30 = szybko rośnie koszt Gemini, kolejka max 100" },
    daily_ai_limit: { min: 100, max: 5000, desc: "Twardy dzienny limit wywołań AI", warn: "< 200 = mało analiz, > 2000 = drogo (~5-10 PLN/dzień)" },
    instant_threshold: { min: 50, max: 90, desc: "Min % zniżki do instant alertu (bez AI)", warn: "< 60 = dużo fałszywych, > 80 = prawie nic nie przejdzie" },
    min_profit: { min: 10, max: 200, desc: "Min zysk (PLN) żeby powiadomić", warn: "< 20 = powiadomienia za tanio, > 100 = pominiesz dobre deale" },
  } as Record<string, { min: number; max: number; desc: string; warn: string }>,
};
