import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

// Check: what % of items that our classifier marks as "shoes" actually have 
// a numeric catalog_id from Vinted API?
const brands = ["Nike", "adidas", "Jordan", "New Balance", "Salomon", "Converse", "Vans", "Asics", "The North Face", "Timberland"];

console.log("Brand".padEnd(18), "Total".padStart(7), "EmptyCat".padStart(9), "Shoes(classified)".padStart(18), "Shoes+NumericCat".padStart(17), "Shoes+Empty".padStart(12));
for (const brand of brands) {
  const total = (db.prepare("SELECT COUNT(*) as c FROM items WHERE brand = ?").get(brand) as any).c;
  const empty = (db.prepare("SELECT COUNT(*) as c FROM items WHERE brand = ? AND (category = '' OR category IS NULL)").get(brand) as any).c;
  
  // Items classified as shoes by our classifier (via title)
  // We can't easily call classifyItemType from SQL, but items with category = 'shoes' were classified by our code
  const shoesClassified = (db.prepare("SELECT COUNT(*) as c FROM items WHERE brand = ? AND category = 'shoes'").get(brand) as any).c;
  
  // Items with Vinted numeric cat IDs that are shoe categories
  const shoeCatIds = ["2961","2711","2952","2955","2695","2713","2706","2960","2945","2954","2694","2682","2710","2697","2951"];
  const shoesNumeric = (db.prepare(`SELECT COUNT(*) as c FROM items WHERE brand = ? AND category IN (${shoeCatIds.map(()=>"?").join(",")})`)
    .get(brand, ...shoeCatIds) as any).c;
  
  // Items that ARE shoes but have empty category (would be missed by categoryIds filter)
  const shoesEmpty = (db.prepare("SELECT COUNT(*) as c FROM items WHERE brand = ? AND category = ''").get(brand) as any).c;
  
  console.log(
    brand.padEnd(18),
    String(total).padStart(7),
    String(empty).padStart(9),
    String(shoesClassified).padStart(18),
    String(shoesNumeric).padStart(17),
    String(shoesEmpty).padStart(12)
  );
}

console.log("\n--- Key insight: Items that Vinted API returns WITH a shoe catalog_id ---");
console.log("If we set categoryIds on the API query, Vinted will only return items that IT categorizes as shoes.");
console.log("Items with empty/custom categories from sellers may be missed.");
console.log("\nBUT: the API filters on Vinted's own catalog, not on our stored category.");
console.log("Items appearing in shoe catalog on Vinted still may have empty catalog_id in response.");

db.close();
