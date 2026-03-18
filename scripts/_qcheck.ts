import Database from "better-sqlite3";
const db = new Database("data/vintedbot.db");

// Recent notified items
const notified = db.prepare(`
  SELECT d.vinted_id, d.level, d.score, d.notified, d.created_at, i.title, i.brand, i.price, i.size
  FROM decisions d JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.notified = 1
  ORDER BY d.created_at DESC LIMIT 20
`).all();
console.log("=== Last 20 notified ===");
for (const n of notified) console.log(n);

// Check if items from earlier are there
const favorites = ["gazelle", "salomon", "vapormax", "reebok", "merrell", "salewa"];
console.log("\n=== Favorites search ===");
for (const fav of favorites) {
  const rows = db.prepare(`
    SELECT i.vinted_id, i.title, i.brand, i.price, i.size, i.discovered_at,
           d.score, d.level, d.notified, d.created_at as decided_at
    FROM items i LEFT JOIN decisions d ON i.vinted_id = d.vinted_id
    WHERE LOWER(i.title) LIKE '%' || ? || '%' OR LOWER(i.brand) LIKE '%' || ? || '%'
    ORDER BY i.discovered_at DESC LIMIT 3
  `).all(fav, fav);
  console.log(`\n--- ${fav} ---`);
  for (const r of rows) console.log(r);
}

// Recent items count
const recent = db.prepare(`SELECT COUNT(*) as cnt, MAX(discovered_at) as latest FROM items WHERE discovered_at > datetime('now', '-30 minutes')`).get();
console.log("\n=== Items last 30min ===", recent);

const decRecent = db.prepare(`SELECT COUNT(*) as cnt, MAX(created_at) as latest FROM decisions WHERE created_at > datetime('now', '-30 minutes')`).get();
console.log("=== Decisions last 30min ===", decRecent);

db.close();
