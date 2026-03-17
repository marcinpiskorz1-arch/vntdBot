import Database from "better-sqlite3";
import { classifyItemType } from "../src/item-classifier.js";

const db = new Database("./data/vintedbot.db");

const row = db.prepare("SELECT * FROM items WHERE vinted_id = ?").get("8416007626") as Record<string, unknown> | undefined;
if (row) {
  console.log("ITEM:", JSON.stringify(row, null, 2));
} else {
  console.log("Item NOT in database");
}

const dec = db.prepare("SELECT * FROM decisions WHERE vinted_id = ?").get("8416007626");
if (dec) {
  console.log("DECISION:", JSON.stringify(dec, null, 2));
} else {
  console.log("No decision record");
}

// Check classifier
const title = "Nike Fsb Chukka";
console.log(`\nclassifyItemType("${title}") =>`, classifyItemType(title));

// Check pricing data
const category = row?.category as string || "";
const size = row?.size as string || "";
const brand = row?.brand as string || "";
console.log(`\nPricing query: brand=${brand}, category=${category}, size=${size}`);

// Check prices with size group
const pricesWithSize = db.prepare(`
  SELECT price, title, size, category FROM items 
  WHERE brand = ? AND category = ? AND size = ? AND price > 0 
  ORDER BY discovered_at DESC LIMIT 30
`).all(brand, category, size);
console.log(`Prices with exact match (brand=${brand}, cat=${category}, size=${size}):`, pricesWithSize.length);
for (const p of pricesWithSize as any[]) {
  console.log(`  ${p.price} PLN | ${p.title} | s:${p.size} | c:${p.category}`);
}

// Check prices without category filter
const pricesNoCat = db.prepare(`
  SELECT price, title, size, category FROM items 
  WHERE brand = ? AND size = ? AND price > 0 
  ORDER BY discovered_at DESC LIMIT 30
`).all(brand, size);
console.log(`\nPrices (brand=${brand}, size=${size}, any cat):`, pricesNoCat.length);
for (const p of pricesNoCat as any[]) {
  console.log(`  ${p.price} PLN | ${p.title} | s:${p.size} | c:${p.category}`);
}

// Check prices for shoes specifically
const classified = classifyItemType(title);
const pricesClassified = db.prepare(`
  SELECT price, title, size, category FROM items 
  WHERE brand = ? AND category = ? AND size = ? AND price > 0 
  ORDER BY discovered_at DESC LIMIT 30
`).all(brand, classified, size);
console.log(`\nPrices (brand=${brand}, cat=${classified}, size=${size}):`, pricesClassified.length);
for (const p of pricesClassified as any[]) {
  console.log(`  ${p.price} PLN | ${p.title} | s:${p.size} | c:${p.category}`);
}

db.close();
