import Database from "better-sqlite3";
import { config } from "../src/config.js";
const db = new Database(config.dbPath, { readonly: true });

console.log("=== HEARTBEATS (last 2h) ===");
const hb = db.prepare(`SELECT * FROM heartbeats WHERE created_at >= datetime('now', '-2 hours') ORDER BY created_at DESC`).all();
console.log("Count:", hb.length);
for (const h of hb as Record<string, unknown>[]) console.log(JSON.stringify(h));

console.log("\n=== AI QUEUE (last 2h) ===");
const aq = db.prepare(`SELECT COUNT(*) as cnt FROM ai_queue WHERE added_at >= datetime('now', '-2 hours')`).get();
console.log(aq);

console.log("\n=== DECISIONS with AI reasoning (last 2h) ===");
const dec = db.prepare(`SELECT d.vinted_id, d.score, d.level, d.ai_reasoning, d.risk_flags, d.created_at FROM decisions d WHERE d.created_at >= datetime('now', '-2 hours') AND d.ai_reasoning != '' ORDER BY d.created_at DESC`).all();
console.log("AI decisions count:", dec.length);
for (const d of dec as Record<string, unknown>[]) console.log(JSON.stringify(d));

console.log("\n=== ALL DECISIONS (last 2h) ===");
const allDec = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN ai_reasoning != '' THEN 1 ELSE 0 END) as with_ai FROM decisions WHERE created_at >= datetime('now', '-2 hours')`).get();
console.log(allDec);

console.log("\n=== ITEMS discovered (last 2h) ===");
const items = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE discovered_at >= datetime('now', '-2 hours')`).get();
console.log(items);

console.log("\n=== HEARTBEATS SUM (last 2h) ===");
const sum = db.prepare(`SELECT SUM(ai_analyzed) as total_ai, SUM(scanned) as total_scanned, SUM(notified) as total_notified, SUM(errors) as total_errors FROM heartbeats WHERE created_at >= datetime('now', '-2 hours')`).get();
console.log(sum);

db.close();
