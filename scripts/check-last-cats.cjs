const Database = require("better-sqlite3");
const db = new Database("data/vintedbot.db", { readonly: true });

const qs = [
  "samsung galaxy s23", "samsung galaxy s24", "google pixel", "xiaomi",
  "thinkpad", "dell xps", "surface pro", "santa cruz",
];

for (const q of qs) {
  const rows = db.prepare(
    "SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE ? GROUP BY category ORDER BY cnt DESC LIMIT 5"
  ).all("%" + q + "%");
  if (!rows.length) continue;
  console.log("\n=== " + q + " ===");
  for (const r of rows.slice(0, 4)) {
    const s = db.prepare(
      "SELECT title, price FROM items WHERE title LIKE ? AND category = ? ORDER BY price DESC LIMIT 2"
    ).all("%" + q + "%", r.category);
    const str = s.map(x => x.price + "PLN " + JSON.stringify(x.title.substring(0, 55))).join(" | ");
    console.log("  cat " + (r.category || "(empty)") + " (" + r.cnt + "): " + str);
  }
}
db.close();
