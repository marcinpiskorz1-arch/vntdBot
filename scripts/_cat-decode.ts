import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");

const numCats = ["2961","2711","2952","2955","2695","2713","2706","734","2960","2945","2954","2694","2682","2710","2697","2936","2939","2951","2937"];
for (const cat of numCats) {
  const sample = db.prepare("SELECT title, brand FROM items WHERE category = ? LIMIT 3").all(cat) as any[];
  console.log(`${cat}: ${sample.map((s: any) => s.title).join(" | ")}`);
}

db.close();
