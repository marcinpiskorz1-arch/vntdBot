import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

const brands = ["Nike", "adidas", "Jordan", "New Balance", "The North Face", "Salomon",
  "Converse", "Vans", "Asics", "Carhartt", "Tommy Hilfiger", "Ralph Lauren",
  "Under Armour", "Columbia", "Helly Hansen", "Timberland", "Mammut"];

for (const brand of brands) {
  const cats = db.prepare(`
    SELECT category, COUNT(*) as cnt 
    FROM items 
    WHERE brand = ? AND category != '' 
    GROUP BY category 
    ORDER BY cnt DESC 
    LIMIT 10
  `).all(brand) as any[];
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE brand = ?`).get(brand) as any;
  const empty = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE brand = ? AND (category = '' OR category IS NULL)`).get(brand) as any;
  
  console.log(`\n${brand} (total: ${total.cnt}, empty cat: ${empty.cnt}):`);
  for (const c of cats) {
    console.log(`  ${String(c.category).padEnd(10)} → ${c.cnt}`);
  }
}

db.close();
