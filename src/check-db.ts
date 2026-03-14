import Database from "better-sqlite3";

const db = new Database("data/vintedbot.db");

const items = db.prepare("SELECT COUNT(*) as cnt FROM items").get() as { cnt: number };
const decisions = db.prepare("SELECT COUNT(*) as cnt FROM decisions").get() as { cnt: number };
const notified = db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE notified = 1").get() as { cnt: number };

console.log(`\n📊 VintedBot Status:`);
console.log(`  Items in DB:     ${items.cnt}`);
console.log(`  Decisions made:  ${decisions.cnt}`);
console.log(`  Notified (sent): ${notified.cnt}`);

console.log(`\n📦 Sample items:`);
const samples = db.prepare("SELECT title, brand, price FROM items ORDER BY id DESC LIMIT 5").all() as { title: string; brand: string; price: number }[];
for (const r of samples) {
  console.log(`  ${r.brand || "?"} | ${r.title} | ${r.price} PLN`);
}

console.log(`\n🏷️ Price history:`);
const prices = db.prepare("SELECT brand, category, median_price, sample_count FROM price_history ORDER BY sample_count DESC LIMIT 5").all() as { brand: string; category: string; median_price: number; sample_count: number }[];
for (const r of prices) {
  console.log(`  ${r.brand} (cat:${r.category}) — median: ${r.median_price} PLN (${r.sample_count} samples)`);
}

db.close();
