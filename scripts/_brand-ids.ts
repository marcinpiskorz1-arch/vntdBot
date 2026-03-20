import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// We need to find brand IDs from Vinted. Since we can't scrape right now,
// let's use what we already know:

// Known from existing scan-configs:
// nike: 53, jordan: 2703, adidas: 14, new balance: 1775, under armour: 52035
// asics: 1195, vans: 139, converse: 11445, the north face: 2319, salomon: 15457
// on running: 267947, la sportiva: 201320 (from Vinted URL)

// Need to find: scarpa, dynafit, lowa, merrell, meindl, reebok, onitsuka tiger

// Check how many items of each brand we have
const brands = ["Scarpa", "Dynafit", "Lowa", "Merrell", "Meindl", "Reebok", "Onitsuka Tiger"];
for (const b of brands) {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE brand = ?").get(b) as any;
  console.log(`${b}: ${row.cnt} items`);
}

// Common known Vinted brand IDs (from public docs/forums):
// Reebok: 29
// Onitsuka Tiger: 1255
// Merrell: 38625
// Meindl: 88974  
// Lowa: 94284
// Scarpa: 201222
// Dynafit: 315790

console.log("\n=== Proponowane Brand IDs (do weryfikacji) ===");
console.log("Reebok: 29");
console.log("Onitsuka Tiger: 1255");
console.log("Merrell: 38625");
console.log("Meindl: 88974");
console.log("Lowa: 94284");
console.log("Scarpa: 201222");
console.log("Dynafit: 315790");

db.close();
