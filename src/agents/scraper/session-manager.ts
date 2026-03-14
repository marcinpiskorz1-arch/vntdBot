import { chromium, type BrowserContext, type Cookie } from "playwright";
import { config } from "../../config.js";
import { logger } from "../../logger.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

export interface VintedSession {
  cookies: Cookie[];
  csrfToken: string;
  userAgent: string;
}

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

/**
 * Opens headless Playwright, loads Vinted, extracts session cookies + CSRF token.
 * This is the "login" step — no actual credentials, just a browser session.
 */
export async function createSession(proxyUrl?: string): Promise<VintedSession> {
  const userAgent = randomUA();
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
  };

  const contextOptions: Parameters<BrowserContext["newPage"]> extends never[]
    ? Record<string, unknown>
    : Record<string, unknown> = {
    userAgent,
  };

  if (proxyUrl) {
    launchOptions.proxy = { server: proxyUrl };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent,
    locale: "pl-PL",
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Navigate to Vinted — this sets session cookies
    await page.goto(config.vintedDomain, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Accept cookies dialog if present
    try {
      await page.click('[id*="onetrust-accept"]', { timeout: 5000 });
    } catch {
      // Cookie banner may not appear — that's fine
    }

    // Wait a moment to let cookies settle
    await page.waitForTimeout(2000);

    const cookies = await context.cookies();

    // Extract CSRF token from cookies or meta tag
    let csrfToken = "";
    const csrfCookie = cookies.find((c) => c.name === "_csrf_token");
    if (csrfCookie) {
      csrfToken = csrfCookie.value;
    } else {
      // Try meta tag
      csrfToken = await page
        .locator('meta[name="csrf-token"]')
        .getAttribute("content")
        .catch(() => "") || "";
    }

    logger.info(
      { cookieCount: cookies.length, hasCsrf: !!csrfToken },
      "Vinted session created"
    );

    return { cookies, csrfToken, userAgent };
  } finally {
    await browser.close();
  }
}

/** Builds cookie header string from Cookie[] */
export function cookieHeader(cookies: Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
