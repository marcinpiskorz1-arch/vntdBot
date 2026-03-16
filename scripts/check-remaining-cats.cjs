const Database = require("better-sqlite3");
const db = new Database("data/vintedbot.db", { readonly: true });

const queries = [
  // Remaining ones we need
  "supreme", "stüssy", "carhartt", "dickies",
  "napapijri", "bape", "ralph lauren", "tommy hilfiger",
  "canada goose", "barbour",
  "columbia", "nervous", "levi's", "wrangler",
  "volcom", "quiksilver", "burton", "oakley", "dakine",
  "alpinestars", "dainese",
  "gore-tex", "primaloft", "cordura", "vibram", "polartec", "pertex",
  "nike tech fleece", "north face nuptse",
  "on running", "on cloudmonster",
  "sony wh-1000xm", "bose qc", "jbl", "g-shock",
  "kindle", "joy-con", "dualshock", "dualsense",
  "logitech mx master", "keychron",
  "ray-ban", "michael kors", "seiko", "casio edifice",
  "petzl", "black diamond", "leatherman", "nalgene", "camelbak",
  "osprey", "santa cruz",
  "thinkpad", "dell xps", "surface pro",
];

for (const q of queries) {
  const rows = db.prepare(
    `SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE ? GROUP BY category ORDER BY cnt DESC LIMIT 5`
  ).all(`%${q}%`);
  
  if (rows.length === 0) continue;
  
  const total = rows.reduce((s, r) => s + r.cnt, 0);
  
  console.log(`\n=== "${q}" (${total}+) ===`);
  for (const r of rows.slice(0, 4)) {
    const samples = db.prepare(
      `SELECT title, price FROM items WHERE title LIKE ? AND category = ? ORDER BY price DESC LIMIT 2`
    ).all(`%${q}%`, r.category);
    const sampleStr = samples.map(s => `${s.price}PLN "${s.title.substring(0,55)}"`).join(" | ");
    console.log(`  cat ${r.category || "(empty)"} (${r.cnt}): ${sampleStr}`);
  }
}

db.close();
