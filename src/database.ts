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

  // Pricing Agent
  getPricesForGroup: db.prepare<{ brand: string; category: string }>(
    `SELECT price FROM items WHERE brand = @brand AND category = @category ORDER BY price`
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
};
