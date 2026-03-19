import Database from "better-sqlite3";
const db = new Database("./data/vintedbot.db");
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused', '0')").run();
console.log("paused set to 0");
db.close();
