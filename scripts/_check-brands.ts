import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// Check all outdoor brands for their brandIds from items in DB
const brands = [
  "La Sportiva", "Scarpa", "Merrell", "Meindl", "Lowa", "Crocs"
];

for (const brand of brands) {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE brand = ?").get(brand) as any;
  console.log(`${brand}: ${count.cnt} items in DB`);
}

// Check La Sportiva items - what brand_id do they have?
// The brand_id comes from Vinted API. Let's check distinct brands text
const laSportiva = db.prepare(
  "SELECT DISTINCT brand FROM items WHERE brand LIKE '%sportiva%' OR brand LIKE '%La Sport%'"
).all();
console.log("\nLa Sportiva variations:", laSportiva);

// From the Vinted page we know brandId is 201320 (from URL: /brand/201320-la-sportiva)
console.log("\nBrand ID from Vinted page: 201320");

// Check all outdoor brand configs that DON'T have brandIds
console.log("\n=== Outdoor configs bez brandIds ===");
console.log("la sportiva - brak brandIds (powinno być 201320)");
console.log("scarpa - brak brandIds");
console.log("merrell - brak brandIds");  
console.log("meindl - brak brandIds");
console.log("lowa - brak brandIds");
console.log("crocs - brak brandIds");

db.close();
