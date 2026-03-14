import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// Schema
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vinted_id       TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    brand           TEXT    NOT NULL DEFAULT '',
    model           TEXT    NOT NULL DEFAULT '',
    price           REAL    NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'PLN',
    size            TEXT    NOT NULL DEFAULT '',
    category        TEXT    NOT NULL DEFAULT '',
    condition       TEXT    NOT NULL DEFAULT '',
    description     TEXT    NOT NULL DEFAULT '',
    photo_urls      TEXT    NOT NULL DEFAULT '[]',
    seller_rating   REAL    NOT NULL DEFAULT 0,
    seller_transactions INTEGER NOT NULL DEFAULT 0,
    listed_at       TEXT    NOT NULL DEFAULT '',
    url             TEXT    NOT NULL DEFAULT '',
    discovered_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_items_vinted_id ON items(vinted_id);
  CREATE INDEX IF NOT EXISTS idx_items_brand_category ON items(brand, category);

  CREATE TABLE IF NOT EXISTS price_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    brand         TEXT    NOT NULL,
    model         TEXT    NOT NULL DEFAULT '',
    category      TEXT    NOT NULL,
    size_group    TEXT    NOT NULL DEFAULT '',
    median_price  REAL    NOT NULL DEFAULT 0,
    p25_price     REAL    NOT NULL DEFAULT 0,
    sample_count  INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(brand, model, category, size_group)
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id       INTEGER NOT NULL REFERENCES items(id),
    vinted_id     TEXT    NOT NULL,
    score         REAL    NOT NULL DEFAULT 0,
    level         TEXT    NOT NULL DEFAULT 'ignore',
    ai_reasoning  TEXT    NOT NULL DEFAULT '',
    risk_flags    TEXT    NOT NULL DEFAULT '[]',
    notified      INTEGER NOT NULL DEFAULT 0,
    user_action   TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_decisions_vinted_id ON decisions(vinted_id);

  CREATE TABLE IF NOT EXISTS heartbeats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cycles      INTEGER NOT NULL DEFAULT 0,
    scanned     INTEGER NOT NULL DEFAULT 0,
    filtered    INTEGER NOT NULL DEFAULT 0,
    underpriced INTEGER NOT NULL DEFAULT 0,
    ai_analyzed INTEGER NOT NULL DEFAULT 0,
    notified    INTEGER NOT NULL DEFAULT 0,
    errors      INTEGER NOT NULL DEFAULT 0,
    ai_queue    INTEGER NOT NULL DEFAULT 0,
    period_min  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_queries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    search_text TEXT NOT NULL UNIQUE,
    priority    INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    added_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vinted_id   TEXT NOT NULL UNIQUE,
    item_json   TEXT NOT NULL,
    signal_json TEXT NOT NULL,
    added_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ============================================================
// Prepared statements — reusable across agents
// ============================================================

export const stmts = {
  // Scraper Agent
  itemExists: db.prepare<{ vinted_id: string }>(
    `SELECT 1 FROM items WHERE vinted_id = @vinted_id LIMIT 1`
  ),
  insertItem: db.prepare(`
    INSERT OR IGNORE INTO items (
      vinted_id, title, brand, model, price, currency, size, category,
      condition, description, photo_urls, seller_rating, seller_transactions,
      listed_at, url
    ) VALUES (
      @vinted_id, @title, @brand, @model, @price, @currency, @size, @category,
      @condition, @description, @photo_urls, @seller_rating, @seller_transactions,
      @listed_at, @url
    )
  `),
  getItemByVintedId: db.prepare<{ vinted_id: string }>(
    `SELECT * FROM items WHERE vinted_id = @vinted_id`
  ),

  // Pricing Agent — 14-day window, with size group
  getPricesForGroupWithSize: db.prepare<{ brand: string; category: string; size: string }>(
    `SELECT price FROM items
     WHERE brand = @brand AND category = @category AND size = @size
       AND discovered_at >= datetime('now', '-14 days')
     ORDER BY price`
  ),
  getPricesForGroup: db.prepare<{ brand: string; category: string }>(
    `SELECT price FROM items
     WHERE brand = @brand AND category = @category
       AND discovered_at >= datetime('now', '-14 days')
     ORDER BY price`
  ),
  upsertPriceHistory: db.prepare(`
    INSERT INTO price_history (brand, model, category, size_group, median_price, p25_price, sample_count, updated_at)
    VALUES (@brand, @model, @category, @size_group, @median_price, @p25_price, @sample_count, datetime('now'))
    ON CONFLICT(brand, model, category, size_group)
    DO UPDATE SET
      median_price = @median_price,
      p25_price = @p25_price,
      sample_count = @sample_count,
      updated_at = datetime('now')
  `),
  getPriceHistory: db.prepare<{ brand: string; model: string; category: string; size_group: string }>(
    `SELECT * FROM price_history WHERE brand = @brand AND model = @model AND category = @category AND size_group = @size_group`
  ),

  // Decision Agent
  insertDecision: db.prepare(`
    INSERT INTO decisions (item_id, vinted_id, score, level, ai_reasoning, risk_flags, notified)
    VALUES (@item_id, @vinted_id, @score, @level, @ai_reasoning, @risk_flags, @notified)
  `),
  updateUserAction: db.prepare<{ vinted_id: string; user_action: string }>(
    `UPDATE decisions SET user_action = @user_action WHERE vinted_id = @vinted_id`
  ),

  // Heartbeat stats
  insertHeartbeat: db.prepare(`
    INSERT INTO heartbeats (cycles, scanned, filtered, underpriced, ai_analyzed, notified, errors, ai_queue, period_min)
    VALUES (@cycles, @scanned, @filtered, @underpriced, @ai_analyzed, @notified, @errors, @ai_queue, @period_min)
  `),

  // Cleanup — delete items older than N days
  deleteOldItems: db.prepare<{ days: number }>(
    `DELETE FROM items WHERE discovered_at < datetime('now', '-' || @days || ' days')
     AND vinted_id NOT IN (SELECT vinted_id FROM decisions WHERE level != 'ignore')`
  ),
  deleteOldDecisions: db.prepare<{ days: number }>(
    `DELETE FROM decisions WHERE created_at < datetime('now', '-' || @days || ' days')`
  ),

  // Settings
  getSetting: db.prepare<{ key: string }>(
    `SELECT value FROM settings WHERE key = @key`
  ),
  setSetting: db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (@key, @value, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = datetime('now')`
  ),
  getAllSettings: db.prepare(`SELECT key, value FROM settings`),

  // Custom queries
  getCustomQueries: db.prepare(
    `SELECT search_text, priority FROM custom_queries WHERE enabled = 1`
  ),
  addCustomQuery: db.prepare(
    `INSERT OR IGNORE INTO custom_queries (search_text, priority) VALUES (@search_text, @priority)`
  ),
  removeCustomQuery: db.prepare<{ search_text: string }>(
    `DELETE FROM custom_queries WHERE search_text = @search_text`
  ),
  listCustomQueries: db.prepare(
    `SELECT search_text, priority, enabled FROM custom_queries ORDER BY added_at`
  ),

  // AI Queue (persistent — survives restarts)
  enqueueAi: db.prepare(
    `INSERT OR IGNORE INTO ai_queue (vinted_id, item_json, signal_json) VALUES (@vinted_id, @item_json, @signal_json)`
  ),
  dequeueAi: db.prepare<{ limit: number }>(
    `SELECT id, item_json, signal_json FROM ai_queue ORDER BY added_at ASC LIMIT @limit`
  ),
  removeFromAiQueue: db.prepare<{ id: number }>(
    `DELETE FROM ai_queue WHERE id = @id`
  ),
  clearAiQueue: db.prepare(
    `DELETE FROM ai_queue`
  ),
  countAiQueue: db.prepare(
    `SELECT COUNT(*) as count FROM ai_queue`
  ),
};
