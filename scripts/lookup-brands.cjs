const { chromium } = require("playwright");

const BRANDS = [
  "nike", "adidas", "jordan", "new balance", "the north face",
  "patagonia", "arcteryx", "salomon", "under armour", "asics",
  "vans", "puma", "converse", "columbia", "carhartt", "supreme",
  "ray-ban", "seiko", "salewa", "la sportiva", "mammut", "hoka",
  "on running", "dickies", "superdry", "dakine", "quiksilver",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  await page.goto("https://www.vinted.pl", { waitUntil: "networkidle", timeout: 30000 });

  // Accept cookies
  try {
    const btn = page.locator("#onetrust-accept-btn-handler");
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  for (const brand of BRANDS) {
    try {
      const result = await page.evaluate(async (keyword) => {
        const r = await fetch(`/api/v2/brands?keyword=${encodeURIComponent(keyword)}&per_page=3`, {
          credentials: "include",
          headers: { "Accept": "application/json" },
        });
        if (!r.ok) return { error: r.status };
        const d = await r.json();
        const hit = d.brands?.[0];
        return hit ? { id: hit.id, title: hit.title } : { notFound: true };
      }, brand);

      if (result.error) console.log(`${brand} -> HTTP ${result.error}`);
      else if (result.notFound) console.log(`${brand} -> NOT FOUND`);
      else console.log(`${brand} -> ${result.id} (${result.title})`);
    } catch (e) {
      console.log(`${brand} -> ERROR: ${e.message}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
