import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// Last heartbeat
const hb = db.prepare("SELECT * FROM heartbeats ORDER BY created_at DESC LIMIT 3").all();
console.log("=== OSTATNIE HEARTBEATY ===");
for (const h of hb) console.log(JSON.stringify(h));

// Decisions from last few hours
const dStats = db.prepare(`
  SELECT level, COUNT(*) as cnt FROM decisions 
  WHERE created_at >= datetime('now', '-3 hours') 
  GROUP BY level
`).all();
console.log("\n=== DECYZJE (ostatnie 3h) ===");
console.log(JSON.stringify(dStats));

// AI analyzed count
const aiCount = db.prepare(`
  SELECT COUNT(*) as cnt FROM decisions 
  WHERE created_at >= datetime('now', '-3 hours') AND ai_reasoning LIKE '%AI%'
`).get();
console.log("\n=== AI PHOTO VERIFY (ostatnie 3h) ===");
console.log(JSON.stringify(aiCount));

// Total items scanned recently
const items = db.prepare(`
  SELECT COUNT(*) as cnt FROM items WHERE discovered_at >= datetime('now', '-3 hours')
`).get();
console.log("\n=== NOWE ITEMY (ostatnie 3h) ===");
console.log(JSON.stringify(items));

// Recent notifications
const notifs = db.prepare(`
  SELECT d.vinted_id, d.score, d.level, i.title, i.brand, i.price, d.created_at
  FROM decisions d JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.notified = 1 AND d.created_at >= datetime('now', '-3 hours')
  ORDER BY d.created_at DESC LIMIT 10
`).all();
console.log("\n=== OSTATNIE POWIADOMIENIA (3h) ===");
for (const n of notifs) console.log(JSON.stringify(n));

db.close();
