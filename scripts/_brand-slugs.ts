import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// Get items with title slugs for each brand
const brands = [
  "Scarpa", "Dynafit", "Lowa", "Merrell", "Meindl", 
  "Reebok", "Onitsuka Tiger", "Crocs"
];

for (const b of brands) {
  const row = db.prepare("SELECT vinted_id, title FROM items WHERE brand = ? ORDER BY discovered_at DESC LIMIT 1").get(b) as any;
  if (row) {
    const slug = row.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
    console.log(`${b}: https://www.vinted.pl/items/${row.vinted_id}-${slug}`);
  } else {
    console.log(`${b}: NO ITEMS`);
  }
}

db.close();
