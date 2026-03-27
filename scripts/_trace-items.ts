import Database from "better-sqlite3";
const db = new Database("data/vintedbot.db");

const ids = ["8494413150", "8433187860", "8494345210", "8494410765"];

for (const id of ids) {
  const item = db.prepare("SELECT vinted_id, title, brand, price, size, condition, category FROM items WHERE vinted_id = ?").get(id) as Record<string, unknown> | undefined;
  const decision = db.prepare("SELECT score, level, ai_reasoning FROM decisions WHERE vinted_id = ?").get(id) as Record<string, unknown> | undefined;
  console.log("---");
  console.log("ID:", id);
  if (item) {
    console.log("FOUND:", JSON.stringify(item));
    if (decision) {
      console.log("DECISION:", JSON.stringify(decision));
    } else {
      console.log("NO DECISION — never scored");
    }
  } else {
    console.log("NOT IN DB — never scraped");
  }
}

// Also check: how many items were scraped in last hour, how many got decisions, how many notified
const stats = db.prepare(`
  SELECT 
    (SELECT COUNT(*) FROM items WHERE discovered_at > datetime('now', '-1 hour')) as scraped_1h,
    (SELECT COUNT(*) FROM decisions WHERE created_at > datetime('now', '-1 hour')) as decided_1h,
    (SELECT COUNT(*) FROM decisions WHERE created_at > datetime('now', '-1 hour') AND level != 'ignore') as notify_1h,
    (SELECT COUNT(*) FROM decisions WHERE created_at > datetime('now', '-1 hour') AND notified = 1) as notified_1h
`).get() as Record<string, number>;
console.log("\n=== LAST HOUR STATS ===");
console.log(JSON.stringify(stats, null, 2));

// Show last 10 decisions
const recent = db.prepare(`
  SELECT d.vinted_id, d.score, d.level, d.notified, i.title, i.brand, i.price, i.size
  FROM decisions d JOIN items i ON d.item_id = i.id
  ORDER BY d.created_at DESC LIMIT 15
`).all();
console.log("\n=== LAST 15 DECISIONS ===");
for (const r of recent as Array<Record<string, unknown>>) {
  console.log(`${r.level} score=${r.score} notified=${r.notified} | ${r.brand} "${r.title}" ${r.price}PLN size=${r.size}`);
}

db.close();
