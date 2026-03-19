import { createSession, cookieHeader } from "../src/agents/scraper/session-manager.js";
import { config } from "../src/config.js";

try {
  console.log("Creating session...");
  const session = await createSession();
  console.log("Session OK");

  // Raw catalog request to see ALL fields in response
  const SHOES = [2961, 2711, 2952, 2955, 2695, 2713, 2706, 2960, 2945, 2954, 2694, 2682, 2710, 2697, 2951, 2691];
  const url = new URL(`${config.vintedDomain}/api/v2/catalog/items`);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "3");
  url.searchParams.set("order", "newest_first");
  url.searchParams.set("search_text", "nike dunk");
  url.searchParams.set("catalog_ids", SHOES.join(","));

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pl",
    "User-Agent": session.userAgent,
    Cookie: cookieHeader(session.cookies),
  };
  if (session.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;

  const resp = await fetch(url.toString(), { headers });
  console.log("Catalog status:", resp.status);
  
  if (resp.ok) {
    const data = await resp.json() as Record<string, unknown>;
    // Print top-level keys
    console.log("Top-level keys:", Object.keys(data).join(", "));
    
    const items = (data.items as Array<Record<string, unknown>>) || [];
    if (items.length > 0) {
      const item = items[0];
      console.log("\n=== First item ALL keys ===");
      console.log(Object.keys(item).join(", "));
      console.log("\n=== First item JSON (truncated) ===");
      const json = JSON.stringify(item, null, 2);
      console.log(json.substring(0, 3000));
      
      // Specifically look for engagement fields
      console.log("\n=== Engagement fields ===");
      for (const key of Object.keys(item)) {
        if (/favour|favorite|like|view|interest|popular|watch/i.test(key)) {
          console.log(`  ${key}:`, item[key]);
        }
      }
    }
  }
  
  // Also test: order=relevance
  url.searchParams.set("order", "relevance");
  const resp2 = await fetch(url.toString(), { headers });
  console.log("\n\norder=relevance status:", resp2.status);
  
  console.log("\nDONE");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("ERROR:", msg.substring(0, 500));
}
process.exit(0);
