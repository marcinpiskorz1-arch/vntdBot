import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// All numeric shoe categories found in DB
const shoeCats = [2961, 2711, 2952, 2955, 2695, 2713, 2706, 2960, 2945, 2954, 2694, 2682, 2710, 2697, 2951, 734];

// Let's check what Vinted's catalog hierarchy might be
// Category 5 = clothing parent? 
// Let's see all distinct numeric categories and group them
const allCats = db.prepare(`
  SELECT category, COUNT(*) as cnt 
  FROM items 
  WHERE category GLOB '[0-9]*' 
  GROUP BY category 
  ORDER BY cnt DESC
  LIMIT 40
`).all() as any[];

console.log("All numeric categories in DB:");
for (const c of allCats) {
  const sample = db.prepare("SELECT title FROM items WHERE category = ? LIMIT 1").get(c.category) as any;
  const title = sample?.title?.substring(0, 50) || "";
  const isShoe = shoeCats.includes(parseInt(c.category));
  console.log(`  ${c.category.padEnd(8)} ${String(c.cnt).padStart(6)} ${isShoe ? "👟" : "  "} ${title}`);
}

db.close();
