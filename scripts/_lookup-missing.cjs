const { chromium } = require("playwright");

const BRANDS = [
  "dachstein", "crank brothers",
];

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "pl-PL",
  });
  const page = await ctx.newPage();

  await page.goto("https://www.vinted.pl", { waitUntil: "domcontentloaded", timeout: 45000 });

  // Wait for Cloudflare challenge — user may need to solve manually
  console.log("Waiting for Cloudflare challenge to pass (up to 30s)...");
  try {
    await page.waitForSelector('input[name="search_text"], [data-testid="searchbar"]', { timeout: 30000 });
    console.log("Cloudflare passed!");
  } catch {
    console.log("Trying to wait longer...");
    await page.waitForTimeout(10000);
  }

  // Accept cookies
  try {
    const btn = page.locator("#onetrust-accept-btn-handler");
    if (await btn.isVisible({ timeout: 5000 })) {
      await btn.click();
      await page.waitForTimeout(2000);
    }
  } catch {}

  // Verify we have session cookies
  const cookies = await ctx.cookies();
  console.log("Cookies count:", cookies.length);
  const sessionCookie = cookies.find(c => c.name === "_vinted_fr_session");
  console.log("Has session cookie:", !!sessionCookie);
  console.log("Cookie names:", cookies.map(c => c.name).join(", "));

  for (const brand of BRANDS) {
    try {
      const result = await page.evaluate(async (keyword) => {
        const r = await fetch(`/api/v2/brands?keyword=${encodeURIComponent(keyword)}&per_page=5`, {
          credentials: "include",
          headers: { "Accept": "application/json" },
        });
        if (!r.ok) return { error: r.status };
        const d = await r.json();
        return d.brands?.slice(0, 3).map(b => ({ id: b.id, title: b.title })) || [];
      }, brand);

      if (result.error) console.log(`${brand} -> HTTP ${result.error}`);
      else console.log(`${brand} -> ${JSON.stringify(result)}`);
    } catch (e) {
      console.log(`${brand} -> ERROR: ${e.message}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
