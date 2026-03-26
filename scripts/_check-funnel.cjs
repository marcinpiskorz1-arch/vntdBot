const Database = require("better-sqlite3");
const db = new Database("./data/vintedbot.db");

// Score distribution today
console.log("=== Score distribution today ===");
const dist = db.prepare(`
  SELECT 
    CASE 
      WHEN score < 4 THEN '< 4.0'
      WHEN score < 5 THEN '4.0-4.9'
      WHEN score < 5.5 THEN '5.0-5.4'
      WHEN score < 5.8 THEN '5.5-5.7'
      WHEN score < 6.0 THEN '5.8-5.9'
      WHEN score < 6.5 THEN '6.0-6.4 (notify)'
      WHEN score < 7.0 THEN '6.5-6.9 (notify)'
      ELSE '7.0+ (hot)'
    END as range,
    COUNT(*) as cnt
  FROM decisions 
  WHERE created_at >= '2026-03-26'
  GROUP BY range
  ORDER BY range
`).all();
console.table(dist);

// Near-miss items (5.5 to 5.9)
console.log("\n=== Near-miss decisions (5.5-5.9) today ===");
const nearMiss = db.prepare(`
  SELECT d.created_at, d.score, d.level, d.vinted_id, i.title, i.brand, i.price, i.size
  FROM decisions d
  LEFT JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.created_at >= '2026-03-26' AND d.score >= 5.5 AND d.score < 6.0
  ORDER BY d.rowid DESC LIMIT 15
`).all();
console.table(nearMiss);

// Items discovered today but NOT in decisions (filtered before scoring)
console.log("\n=== Items discovered today ===");
const totalDiscovered = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE discovered_at >= '2026-03-26'").get();
console.log("Total discovered:", totalDiscovered.cnt);

const totalDecisions = db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE created_at >= '2026-03-26'").get();
console.log("Total decisions:", totalDecisions.cnt);
console.log("Filtered before decision:", totalDiscovered.cnt - totalDecisions.cnt);

// Brand distribution of decisions
console.log("\n=== Brand distribution in decisions today ===");
const brands = db.prepare(`
  SELECT i.brand, COUNT(*) as cnt, 
    SUM(CASE WHEN d.level='notify' THEN 1 ELSE 0 END) as notified,
    ROUND(AVG(d.score), 1) as avg_score
  FROM decisions d
  LEFT JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.created_at >= '2026-03-26'
  GROUP BY i.brand
  ORDER BY cnt DESC LIMIT 20
`).all();
console.table(brands);

// Check what types are being blocked
console.log("\n=== Recent items with empty itemType (blocked by classifier?) ===");
const emptyType = db.prepare(`
  SELECT i.vinted_id, i.title, i.brand, i.price, i.category, i.size
  FROM items i
  WHERE i.discovered_at >= '2026-03-26'
  AND i.vinted_id NOT IN (SELECT vinted_id FROM decisions WHERE created_at >= '2026-03-26')
  ORDER BY i.rowid DESC LIMIT 20
`).all();
console.table(emptyType);
