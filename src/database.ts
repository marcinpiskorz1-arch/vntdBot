import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { classifyItemType, vintedCategoryToItemType } from "./item-classifier.js";
import { extractModel } from "./model-extractor.js";

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
  CREATE INDEX IF NOT EXISTS idx_items_brand_model_category ON items(brand, model, category);

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
    discount_pct REAL NOT NULL DEFAULT 0,
    added_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vinted_id   TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL DEFAULT '',
    brand       TEXT NOT NULL DEFAULT '',
    price       REAL NOT NULL DEFAULT 0,
    url         TEXT NOT NULL DEFAULT '',
    photo_url   TEXT NOT NULL DEFAULT '',
    score       REAL NOT NULL DEFAULT 0,
    added_at    TEXT NOT NULL DEFAULT (datetime('now')),
    sold_at     TEXT,
    status      TEXT NOT NULL DEFAULT 'active'
  );
`);

// ============================================================
// Migrations for existing databases
// ============================================================
try {
  db.exec(`ALTER TABLE ai_queue ADD COLUMN discount_pct REAL NOT NULL DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE items ADD COLUMN favourite_count INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

try {
  db.exec(`ALTER TABLE items ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// One-time fix: reset phantom notified=1 set by persist() before actual Telegram send
// Uses a sentinel row in settings to ensure it only runs once
{
  const alreadyRan = db.prepare(`SELECT 1 FROM settings WHERE key = 'migration_reset_notified_v1'`).get();
  if (!alreadyRan) {
    const reset = db.prepare(`UPDATE decisions SET notified = 0 WHERE notified = 1`);
    const result = reset.run();
    if (result.changes > 0) {
      logger.info({ count: result.changes }, "🔧 Reset phantom notified flags — items will be re-sent");
    }
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('migration_reset_notified_v1', '1')`).run();
  }
}

// Backfill item type classification for items with empty category
{
  const unclassified = db.prepare(
    `SELECT id, title FROM items WHERE category = '' AND discovered_at >= datetime('now', '-14 days')`
  ).all() as Array<{ id: number; title: string }>;

  if (unclassified.length > 0) {
    const updateStmt = db.prepare(`UPDATE items SET category = @category WHERE id = @id`);
    const backfill = db.transaction((rows: Array<{ id: number; title: string }>) => {
      let updated = 0;
      for (const row of rows) {
        const itemType = classifyItemType(row.title);
        if (itemType) {
          updateStmt.run({ id: row.id, category: itemType });
          updated++;
        }
      }
      return updated;
    });
    backfill(unclassified);
  }
}

// Backfill model extraction for items with empty model (14-day window)
{
  const noModel = db.prepare(
    `SELECT id, brand, title FROM items WHERE model = '' AND discovered_at >= datetime('now', '-14 days')`
  ).all() as Array<{ id: number; brand: string; title: string }>;

  if (noModel.length > 0) {
    const updateStmt = db.prepare(`UPDATE items SET model = @model WHERE id = @id`);
    const backfill = db.transaction((rows: Array<{ id: number; brand: string; title: string }>) => {
      let updated = 0;
      for (const row of rows) {
        const model = extractModel(row.brand, row.title);
        if (model) {
          updateStmt.run({ id: row.id, model });
          updated++;
        }
      }
      return updated;
    });
    backfill(noModel);
  }
}

// Purge stale price_history entries from pre-model-aware era
// These have model != '' but sample_count from brand-level queries (wrong medians)
db.exec(`DELETE FROM price_history WHERE model != '' AND sample_count > 3000`);

// Migrate items with numeric Vinted category IDs to text-based types
// and purge price_history entries with numeric categories (they'll be rebuilt)
{
  const numericCats = db.prepare(
    `SELECT id, title, category FROM items WHERE category GLOB '[0-9]*' AND discovered_at >= datetime('now', '-14 days')`
  ).all() as Array<{ id: number; title: string; category: string }>;

  if (numericCats.length > 0) {
    const updateStmt = db.prepare(`UPDATE items SET category = @category WHERE id = @id`);
    const migrate = db.transaction((rows: Array<{ id: number; title: string; category: string }>) => {
      let updated = 0;
      for (const row of rows) {
        const resolved = classifyItemType(row.title) || vintedCategoryToItemType(row.category);
        if (resolved) {
          updateStmt.run({ id: row.id, category: resolved });
          updated++;
        }
      }
      return updated;
    });
    migrate(numericCats);
  }

  // Purge price_history with numeric categories — will be rebuilt from clean data
  db.exec(`DELETE FROM price_history WHERE category GLOB '[0-9]*'`);
}

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
      favourite_count, view_count, listed_at, url
    ) VALUES (
      @vinted_id, @title, @brand, @model, @price, @currency, @size, @category,
      @condition, @description, @photo_urls, @seller_rating, @seller_transactions,
      @favourite_count, @view_count, @listed_at, @url
    )
  `),
  getItemByVintedId: db.prepare<{ vinted_id: string }>(
    `SELECT * FROM items WHERE vinted_id = @vinted_id`
  ),

  // Pricing Agent — 14-day window, with size group
  getPricesForModelWithSize: db.prepare<{ brand: string; model: string; category: string; size: string }>(
    `SELECT price FROM items
     WHERE brand = @brand AND model = @model AND category = @category AND size = @size
       AND discovered_at >= datetime('now', '-14 days')
     ORDER BY price`
  ),
  getPricesForModel: db.prepare<{ brand: string; model: string; category: string }>(
    `SELECT price FROM items
     WHERE brand = @brand AND model = @model AND category = @category
       AND discovered_at >= datetime('now', '-14 days')
     ORDER BY price`
  ),
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
  isAlreadyNotified: db.prepare<{ vinted_id: string }>(
    `SELECT 1 FROM decisions WHERE vinted_id = @vinted_id AND notified = 1 LIMIT 1`
  ),
  markNotified: db.prepare<{ vinted_id: string }>(
    `UPDATE decisions SET notified = 1 WHERE vinted_id = @vinted_id`
  ),
  hasDecision: db.prepare<{ vinted_id: string }>(
    `SELECT 1 FROM decisions WHERE vinted_id = @vinted_id LIMIT 1`
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

  // Favorites
  addFavorite: db.prepare(
    `INSERT OR IGNORE INTO favorites (vinted_id, title, brand, price, url, photo_url, score)
     VALUES (@vinted_id, @title, @brand, @price, @url, @photo_url, @score)`
  ),
  removeFavorite: db.prepare<{ vinted_id: string }>(
    `DELETE FROM favorites WHERE vinted_id = @vinted_id`
  ),
  getFavorites: db.prepare(
    `SELECT * FROM favorites WHERE status = 'active' ORDER BY added_at DESC`
  ),
  getAllFavorites: db.prepare(
    `SELECT * FROM favorites ORDER BY added_at DESC`
  ),
  markFavoriteSold: db.prepare<{ vinted_id: string }>(
    `UPDATE favorites SET status = 'sold', sold_at = datetime('now') WHERE vinted_id = @vinted_id`
  ),
  getFavoriteByVintedId: db.prepare<{ vinted_id: string }>(
    `SELECT * FROM favorites WHERE vinted_id = @vinted_id`
  ),
  getActiveFavoriteUrls: db.prepare(
    `SELECT vinted_id, url, title, price, added_at FROM favorites WHERE status = 'active'`
  ),
  getFavoriteStats: db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
       AVG(CASE WHEN status = 'sold' THEN
         (julianday(sold_at) - julianday(added_at)) * 24
       END) as avg_hours_to_sell
     FROM favorites`
  ),

  // Catch-up: items discovered recently but never evaluated
  getUndecidedItems: db.prepare<{ hours: number; limit: number }>(
    `SELECT * FROM items
     WHERE discovered_at >= datetime('now', '-' || @hours || ' hours')
       AND vinted_id NOT IN (SELECT vinted_id FROM decisions)
     ORDER BY discovered_at DESC
     LIMIT @limit`
  ),

  // Catch-up: decisions made but never sent to Telegram (notified=0, level != ignore)
  getUnsentDecisions: db.prepare<{ hours: number; limit: number }>(
    `SELECT d.vinted_id, d.score, d.level, d.ai_reasoning, d.risk_flags,
            i.title, i.brand, i.model, i.price, i.currency, i.size, i.category,
            i.condition, i.description, i.photo_urls, i.seller_rating,
            i.seller_transactions, i.listed_at, i.url
     FROM decisions d
     JOIN items i ON i.vinted_id = d.vinted_id
     WHERE d.notified = 0
       AND d.level != 'ignore'
       AND d.created_at >= datetime('now', '-' || @hours || ' hours')
     ORDER BY d.score DESC
     LIMIT @limit`
  ),
};
