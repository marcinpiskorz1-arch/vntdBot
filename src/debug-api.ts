import "dotenv/config";
import { createSession, cookieHeader } from "./agents/scraper/session-manager.js";

async function debugApi() {
  console.log("Creating session...");
  const session = await createSession();

  const url = "https://www.vinted.pl/api/v2/catalog/items?page=1&per_page=5&order=newest_first&search_text=nike+air+max";

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pl",
    "User-Agent": session.userAgent,
    Cookie: cookieHeader(session.cookies),
  };

  if (session.csrfToken) {
    headers["X-CSRF-Token"] = session.csrfToken;
  }

  console.log("Fetching API...");
  const response = await fetch(url, { method: "GET", headers });
  const data = await response.json();

  // Print first item raw
  if (data.items && data.items.length > 0) {
    console.log("\n=== RAW FIRST ITEM ===");
    console.log(JSON.stringify(data.items[0], null, 2));
  } else {
    console.log("\n=== FULL RESPONSE ===");
    console.log(JSON.stringify(data, null, 2).slice(0, 3000));
  }
}

debugApi().catch(console.error);
