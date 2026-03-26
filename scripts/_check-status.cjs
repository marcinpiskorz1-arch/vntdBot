const Database = require("better-sqlite3");
const db = new Database("./data/vintedbot.db");

// Schema check
const cols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
console.log("items columns:", cols.join(", "));

const dcols = db.prepare("PRAGMA table_info(decisions)").all().map(c => c.name);
console.log("decisions columns:", dcols.join(", "));

// Total counts
const totalItems = db.prepare("SELECT COUNT(*) as cnt FROM items").get();
console.log("Total items:", totalItems.cnt);

const totalDecisions = db.prepare("SELECT COUNT(*) as cnt FROM decisions").get();
console.log("Total decisions:", totalDecisions.cnt);

// Recent decisions by level
const byLevel = db.prepare("SELECT level, COUNT(*) as cnt FROM decisions GROUP BY level ORDER BY cnt DESC").all();
console.log("Decisions by level:", byLevel);

// Last 20 decisions
const last20 = db.prepare("SELECT vinted_id, score, level FROM decisions ORDER BY rowid DESC LIMIT 20").all();
console.log("Last 20 decisions:", last20);

// Last 5 notified/hot
const notified = db.prepare("SELECT vinted_id, score, level FROM decisions WHERE level IN ('notify','hot','popular') ORDER BY rowid DESC LIMIT 10").all();
console.log("Last notified:", notified);

// Heartbeats
const heartbeats = db.prepare("SELECT * FROM heartbeats ORDER BY rowid DESC LIMIT 3").all();
console.log("Recent heartbeats:", JSON.stringify(heartbeats, null, 2));
