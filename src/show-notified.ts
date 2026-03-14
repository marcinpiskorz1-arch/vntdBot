import Database from "better-sqlite3";
const db = new Database("data/vintedbot.db");
const rows = db.prepare(`
  SELECT i.brand, i.title, i.price, i.currency, d.score, d.level
  FROM decisions d JOIN items i ON d.item_id = i.id
  WHERE d.level IN ('notify', 'hot')
  ORDER BY d.created_at DESC
  LIMIT 15
`).all() as any[];

console.log("\n📋 Ostatnie powiadomienia:");
for (const r of rows) {
  console.log(`  [${r.score}] ${r.brand} | ${r.title} | ${r.price} ${r.currency}`);
}
console.log(`\n  Łącznie: ${rows.length}`);
