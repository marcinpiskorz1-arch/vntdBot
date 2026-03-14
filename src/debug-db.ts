import Database from "better-sqlite3";

const db = new Database("data/vintedbot.db");

// Check raw data
const items = db.prepare("SELECT vinted_id, title, brand, price, category FROM items LIMIT 10").all();
console.log("Raw items from DB:");
console.log(JSON.stringify(items, null, 2));

db.close();
