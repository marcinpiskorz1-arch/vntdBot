import Database from "better-sqlite3";
const db = new Database("data/vintedbot.db");

// Recent decisions
const stats = db.prepare(`SELECT level, COUNT(*) as cnt FROM decisions WHERE created_at > datetime('now', '-1 hour') GROUP BY level`).all();
console.log("DECISIONS LAST HOUR:", stats);

// Items with decent scores
const top = db.prepare(`
  SELECT d.score, d.level, d.notified, i.brand, i.price, i.size, i.title 
  FROM decisions d JOIN items i ON d.item_id = i.id 
  WHERE d.created_at > datetime('now', '-1 hour') AND d.score >= 4.5 
  ORDER BY d.score DESC
`).all() as Array<Record<string, unknown>>;
console.log("\nSCORE >= 4.5 (last hour):");
for (const x of top) {
  console.log(`  ${x.level} score=${x.score} ${x.notified ? "SENT" : ""} | ${x.brand} ${x.price}PLN size=${x.size} "${(x.title as string)?.slice(0, 55)}"`);
}

// Settings
const settings = db.prepare(`SELECT key, value FROM settings`).all();
console.log("\nSETTINGS:", settings);

// How many items scraped in last hour
const scraped = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE discovered_at > datetime('now', '-1 hour')`).get() as Record<string, number>;
console.log("\nSCRAPED LAST HOUR:", scraped.cnt);

// How many unique brands scraped
const brands = db.prepare(`SELECT brand, COUNT(*) as cnt FROM items WHERE discovered_at > datetime('now', '-1 hour') GROUP BY brand ORDER BY cnt DESC LIMIT 15`).all();
console.log("\nTOP BRANDS SCRAPED:", brands);

db.close();
