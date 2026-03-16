const Database = require("better-sqlite3");
const db = new Database("data/vintedbot.db", { readonly: true });

// Get ALL unique search texts from scan configs to check them all
const queries = [
  // Sneakers / buty
  "nike", "jordan", "adidas", "new balance", "asics", "vans", "under armour",
  "nike dunk", "nike air max", "nike air force", "nike blazer", "nike sb",
  "adidas samba", "adidas gazelle", "adidas yeezy", "adidas spezial",
  "converse", "dc shoes", "timberland",
  // Outdoor buty 
  "la sportiva", "scarpa", "meindl", "lowa", "merrell", "salomon", "hunter boots",
  // Outdoor odziez
  "arc'teryx", "mammut", "the north face", "patagonia", "fjällräven",
  "helly hansen", "peak performance", "rab", "millet", "haglöfs",
  "revolutionrace", "norrøna", "dynafit", "save the duck",
  // Streetwear / hype
  "supreme", "stüssy", "carhartt", "dickies",
  "napapijri", "bape", "ralph lauren", "tommy hilfiger",
  "canada goose", "barbour",
  "columbia", "nervous",
  // Workwear / vintage
  "levi's", "wrangler",
  // Snow / board
  "volcom", "quiksilver", "burton", "oakley", "dakine",
  // Moto
  "alpinestars", "fox racing", "dainese",
  // Tech materials
  "gore-tex", "goretex", "primaloft", "cordura", "vibram", "polartec",
  "windstopper", "pertex",
  // Specific models
  "nike tech fleece", "north face nuptse", "north face 1996",
  "on running", "on cloudmonster", "salomon xt-6",
  // Audio / wearables
  "sony wh-1000xm", "bose qc", "jbl", "g-shock",
  // Small tech
  "kindle", "joy-con", "dualshock", "dualsense",
  "logitech mx master", "keychron",
  // Accessories
  "ray-ban", "michael kors", "seiko", "casio edifice", "orient zegarek",
  // Outdoor accessories
  "petzl", "black diamond", "leatherman", "nalgene", "camelbak",
  // Osprey
  "osprey",
  // Samsung / Xiaomi / Pixel
  "samsung galaxy s23", "samsung galaxy s24", "google pixel",
  // Thinkpad / Dell / Surface
  "thinkpad", "dell xps",
  // Santa Cruz
  "santa cruz",
];

for (const q of queries) {
  const rows = db.prepare(
    `SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE ? GROUP BY category ORDER BY cnt DESC LIMIT 8`
  ).all(`%${q}%`);
  
  if (rows.length === 0) continue;
  
  const total = rows.reduce((s, r) => s + r.cnt, 0);
  
  // Show sample titles for top 3 categories
  console.log(`\n=== "${q}" (${total} total) ===`);
  for (const r of rows.slice(0, 5)) {
    const samples = db.prepare(
      `SELECT title, price FROM items WHERE title LIKE ? AND category = ? ORDER BY price DESC LIMIT 2`
    ).all(`%${q}%`, r.category);
    const sampleStr = samples.map(s => `${s.price}PLN "${s.title.substring(0,60)}"`).join(" | ");
    console.log(`  cat ${r.category || "(empty)"} (${r.cnt}): ${sampleStr}`);
  }
}

db.close();
