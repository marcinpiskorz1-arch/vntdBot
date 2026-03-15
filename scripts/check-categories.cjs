const Database = require("better-sqlite3");
const db = new Database("data/vintedbot.db", { readonly: true });

console.log("\n=== iPhone items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%iphone%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== iPad items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%ipad%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== MacBook items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%macbook%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== AirPods items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%airpods%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Switch items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%switch%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Steam Deck items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%steam deck%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Samsung Galaxy items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%galaxy s2%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Sample titles per category (iphone) ===");
const cats = db.prepare("SELECT DISTINCT category FROM items WHERE title LIKE '%iphone%'").all();
for (const c of cats) {
  const samples = db.prepare("SELECT title, price, category FROM items WHERE title LIKE '%iphone%' AND category = ? ORDER BY price DESC LIMIT 3").all(c.category);
  console.log(`\nCategory ${c.category}:`);
  for (const s of samples) {
    console.log(`  ${s.price} PLN - ${s.title}`);
  }
}

console.log("\n=== Apple Watch items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%apple watch%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Garmin items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%garmin%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== LEGO items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%lego%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Jordan items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%jordan%' GROUP BY category ORDER BY cnt DESC LIMIT 20").all());

console.log("\n=== Nike items by category ===");
console.table(db.prepare("SELECT category, COUNT(*) as cnt FROM items WHERE title LIKE '%nike%' GROUP BY category ORDER BY cnt DESC LIMIT 10").all());

db.close();
