import Database from "better-sqlite3";

const db = new Database("./data/vintedbot.db");
const vintedId = "8412484100";

// Check items table
const item = db.prepare("SELECT * FROM items WHERE vinted_id = @id").get({ id: vintedId });
console.log("=== ITEM ===");
console.log(item ? JSON.stringify(item, null, 2) : "NOT FOUND in items table");

// Check decisions table
const decision = db.prepare("SELECT * FROM decisions WHERE vinted_id = @id").get({ id: vintedId });
console.log("\n=== DECISION ===");
console.log(decision ? JSON.stringify(decision, null, 2) : "NOT FOUND in decisions table");

// Check price_history for salomon
const prices = db.prepare("SELECT * FROM price_history WHERE brand LIKE '%salomon%' ORDER BY updated_at DESC LIMIT 20").all();
console.log("\n=== PRICE HISTORY (salomon, last 20) ===");
console.log(JSON.stringify(prices, null, 2));

// Check if there's a decision that was inserted differently
const allDecisions = db.prepare("SELECT d.*, i.title, i.brand, i.price FROM decisions d JOIN items i ON d.item_id = i.id WHERE i.brand LIKE '%Salomon%' ORDER BY d.created_at DESC LIMIT 10").all();
console.log("\n=== RECENT SALOMON DECISIONS ===");
console.log(JSON.stringify(allDecisions, null, 2));

// Check recent items for salomon to see if others were processed
const recentSalomon = db.prepare("SELECT vinted_id, title, price, size, discovered_at FROM items WHERE brand LIKE '%Salomon%' ORDER BY discovered_at DESC LIMIT 10").all();
console.log("\n=== RECENT SALOMON ITEMS ===");
console.log(JSON.stringify(recentSalomon, null, 2));

db.close();
