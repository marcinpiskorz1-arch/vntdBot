import Database from "better-sqlite3";
import { classifyItemType } from "../src/item-classifier.js";

const db = new Database("./data/vintedbot.db");

const ITEM_ID = "8416146167";

const row = db.prepare("SELECT * FROM items WHERE vinted_id = ?").get(ITEM_ID) as Record<string, unknown> | undefined;
if (row) {
  console.log("ITEM:", JSON.stringify(row, null, 2));
} else {
  console.log("Item NOT in database");
}

const dec = db.prepare("SELECT * FROM decisions WHERE vinted_id = ?").get(ITEM_ID);
if (dec) {
  console.log("DECISION:", JSON.stringify(dec, null, 2));
} else {
  console.log("No decision record");
}

// Check how many Adidas items were recently scanned
const recentAdidas = db.prepare(`
  SELECT COUNT(*) as cnt, MAX(discovered_at) as latest FROM items WHERE brand = 'Adidas'
`).get() as any;
console.log(`\nAdidas items total: ${recentAdidas.cnt}, latest: ${recentAdidas.latest}`);

// Check most recent items overall
const lastItems = db.prepare(`
  SELECT vinted_id, title, brand, price, size, discovered_at FROM items 
  ORDER BY id DESC LIMIT 5
`).all() as any[];
console.log("\nLast 5 items inserted:");
for (const i of lastItems) {
  console.log(`  ${i.vinted_id} | ${i.brand} | ${i.title} | ${i.price} PLN | ${i.discovered_at}`);
}

// Check classifier
console.log(`\nclassifyItemType("Adidas painonnostokengät") =>`, JSON.stringify(classifyItemType("Adidas painonnostokengät")));
console.log(`classifyItemType("adidas painonnostokengat") =>`, JSON.stringify(classifyItemType("adidas painonnostokengat")));

db.close();
