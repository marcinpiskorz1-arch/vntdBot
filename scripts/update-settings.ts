import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('min_profit', '35')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('notify_threshold', '6.0')").run();
console.log("Settings updated: min_profit=35, notify_threshold=6.0");
const rows = db.prepare("SELECT * FROM settings").all();
for (const r of rows) console.log(`  ${(r as any).key} = ${(r as any).value}`);
db.close();
