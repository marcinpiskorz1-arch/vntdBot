import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

console.log("=== STATYSTYKI SESJI ===\n");

// Total items in DB
const totalItems = db.prepare("SELECT COUNT(*) as cnt FROM items").get() as { cnt: number };
console.log(`Łącznie itemów w bazie: ${totalItems.cnt}`);

// Items from last 2 hours (our session)
const recentItems = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE discovered_at >= datetime('now', '-2 hours')").get() as { cnt: number };
console.log(`Nowe itemy (ostatnie 2h): ${recentItems.cnt}`);

// Decisions from last 2 hours
const decisions = db.prepare(`
  SELECT level, COUNT(*) as cnt FROM decisions 
  WHERE created_at >= datetime('now', '-2 hours') 
  GROUP BY level
`).all() as { level: string; cnt: number }[];
console.log("\n=== DECYZJE (ostatnie 2h) ===");
for (const d of decisions) console.log(`  ${d.level}: ${d.cnt}`);

// Notifications sent
const notified = db.prepare(`
  SELECT COUNT(*) as cnt FROM decisions 
  WHERE created_at >= datetime('now', '-2 hours') AND notified = 1
`).get() as { cnt: number };
console.log(`\nNotyfikacje wysłane: ${notified.cnt}`);

// Score distribution
const scoreDist = db.prepare(`
  SELECT 
    CASE 
      WHEN score >= 8 THEN '8-10 (hot)'
      WHEN score >= 6 THEN '6-8 (notify)'
      WHEN score >= 4 THEN '4-6 (borderline)'
      ELSE '0-4 (ignore)'
    END as range,
    COUNT(*) as cnt,
    ROUND(AVG(score), 1) as avg_score
  FROM decisions 
  WHERE created_at >= datetime('now', '-2 hours')
  GROUP BY range
  ORDER BY avg_score DESC
`).all();
console.log("\n=== ROZKŁAD SCORE ===");
for (const s of scoreDist) console.log(`  ${JSON.stringify(s)}`);

// Top notified items
const topNotified = db.prepare(`
  SELECT d.vinted_id, d.score, d.level, i.title, i.brand, i.price, i.size, i.favourite_count, i.view_count
  FROM decisions d
  JOIN items i ON d.vinted_id = i.vinted_id  
  WHERE d.created_at >= datetime('now', '-2 hours') AND d.notified = 1
  ORDER BY d.score DESC
  LIMIT 10
`).all();
console.log("\n=== TOP 10 NOTYFIKACJI ===");
for (const t of topNotified) console.log(`  Score ${(t as any).score} | ${(t as any).brand} ${(t as any).title} | ${(t as any).price} PLN | r.${(t as any).size} | ❤️${(t as any).favourite_count} 👁${(t as any).view_count}`);

// Brands breakdown
const brands = db.prepare(`
  SELECT i.brand, COUNT(*) as cnt, ROUND(AVG(d.score), 1) as avg
  FROM decisions d
  JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.created_at >= datetime('now', '-2 hours')
  GROUP BY i.brand
  ORDER BY cnt DESC
  LIMIT 15
`).all();
console.log("\n=== TOP MARKI (w decyzjach) ===");
for (const b of brands) console.log(`  ${(b as any).brand}: ${(b as any).cnt} items, avg score ${(b as any).avg}`);

// Filter breakdown from items (size distribution)
const sizes = db.prepare(`
  SELECT size, COUNT(*) as cnt
  FROM items 
  WHERE discovered_at >= datetime('now', '-2 hours') AND size != ''
  GROUP BY size
  ORDER BY cnt DESC
  LIMIT 20
`).all();
console.log("\n=== TOP ROZMIARY (nowe itemy) ===");
for (const s of sizes) console.log(`  ${(s as any).size}: ${(s as any).cnt}`);

// Favourite count distribution
const favDist = db.prepare(`
  SELECT 
    CASE 
      WHEN favourite_count >= 10 THEN '10+ (hot)'
      WHEN favourite_count >= 5 THEN '5-9'
      WHEN favourite_count >= 2 THEN '2-4'
      WHEN favourite_count >= 1 THEN '1'
      ELSE '0'
    END as fav_range,
    COUNT(*) as cnt
  FROM items 
  WHERE discovered_at >= datetime('now', '-2 hours')
  GROUP BY fav_range
  ORDER BY cnt DESC
`).all();
console.log("\n=== ROZKŁAD POLUBIEŃ (nowe itemy) ===");
for (const f of favDist) console.log(`  ${(f as any).fav_range}: ${(f as any).cnt}`);

// Errors: check if 429/403 happened
const settings = db.prepare("SELECT * FROM settings").all();
console.log("\n=== USTAWIENIA ===");
for (const s of settings) console.log(`  ${(s as any).key} = ${(s as any).value}`);

db.close();
