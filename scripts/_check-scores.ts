import Database from "better-sqlite3";
const db = new Database("data/vintedbot.db");

console.log("=== RECENT DECISIONS score >= 4.5 (last 3h) ===");
const rows = db.prepare(`
  SELECT d.score, d.level, d.ai_reasoning, i.title, i.brand, i.price, i.size
  FROM decisions d JOIN items i ON d.vinted_id = i.vinted_id
  WHERE d.created_at > datetime('now', '-3 hours')
  AND d.score >= 4.5
  ORDER BY d.score DESC
  LIMIT 20
`).all() as Array<{ score: number; level: string; ai_reasoning: string; title: string; brand: string; price: number; size: string }>;

for (const r of rows) {
  console.log(
    r.level.padEnd(7),
    String(r.score).padEnd(4),
    String(r.price).padEnd(7) + "PLN",
    (r.brand || "?").padEnd(15),
    (r.size || "?").padEnd(5),
    r.title?.slice(0, 50),
  );
}

console.log("\n=== DECISION DISTRIBUTION (last 3h) ===");
const dist = db.prepare(`
  SELECT level, COUNT(*) as cnt, ROUND(AVG(score),1) as avg_score
  FROM decisions
  WHERE created_at > datetime('now', '-3 hours')
  GROUP BY level
`).all() as Array<{ level: string; cnt: number; avg_score: number }>;
for (const d of dist) console.log(d.level, "count:", d.cnt, "avg_score:", d.avg_score);

console.log("\n=== WOULD-NOTIFY SIMULATION ===");
const cnt50 = (db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE created_at > datetime('now', '-3 hours') AND score >= 5.0").get() as any).cnt;
const cnt55 = (db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE created_at > datetime('now', '-3 hours') AND score >= 5.5").get() as any).cnt;
const total = (db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE created_at > datetime('now', '-3 hours')").get() as any).cnt;
console.log("score >= 5.0:", cnt50, "/ total:", total);
console.log("score >= 5.5:", cnt55, "/ total:", total);

db.close();
