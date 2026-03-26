const Database = require("better-sqlite3");
const db = new Database("./data/vintedbot.db");

console.log("=== Last 15 decisions ===");
const last15 = db.prepare("SELECT created_at, score, level, vinted_id, notified FROM decisions ORDER BY rowid DESC LIMIT 15").all();
console.table(last15);

console.log("\n=== Last 10 notified (notified=1) ===");
const notified = db.prepare("SELECT created_at, score, level, vinted_id FROM decisions WHERE notified=1 ORDER BY rowid DESC LIMIT 10").all();
console.table(notified);

console.log("\n=== Decisions today ===");
const today = db.prepare("SELECT level, COUNT(*) as cnt FROM decisions WHERE created_at >= '2026-03-26' GROUP BY level ORDER BY cnt DESC").all();
console.table(today);

console.log("\n=== Notify decisions today ===");
const notifyToday = db.prepare("SELECT created_at, score, vinted_id, notified FROM decisions WHERE level IN ('notify','hot','popular') AND created_at >= '2026-03-26' ORDER BY rowid DESC LIMIT 20").all();
console.table(notifyToday);

console.log("\n=== Items discovered last hour ===");
const recentItems = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE discovered_at >= datetime('now', '-1 hour')").get();
console.log("Items last hour:", recentItems.cnt);

console.log("\n=== Errors in heartbeats ===");
const hb = db.prepare("SELECT created_at, cycles, scanned, filtered, underpriced, ai_analyzed, notified, errors FROM heartbeats ORDER BY rowid DESC LIMIT 3").all();
console.table(hb);
