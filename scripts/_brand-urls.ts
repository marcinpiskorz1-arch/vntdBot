import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// Get one recent item ID for each brand we need
const brands = ["Scarpa", "Dynafit", "Lowa", "Merrell", "Meindl", "Reebok", "Onitsuka Tiger"];
for (const b of brands) {
  const row = db.prepare("SELECT vinted_id, title FROM items WHERE brand = ? LIMIT 1").get(b) as any;
  if (row) {
    console.log(`${b}: https://www.vinted.pl/items/${row.vinted_id}`);
  } else {
    console.log(`${b}: NO ITEMS IN DB`);
  }
}

db.close();
