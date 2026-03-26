import { config } from "../../config.js";
import { logger } from "../../logger.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { type VintedSession, cookieHeader } from "./session-manager.js";
import { ProxyAgent, fetch as proxiedFetch } from "undici";

// Vinted API response shape (partial — only fields we need)
interface VintedCatalogResponse {
  items: VintedApiItem[];
}

interface VintedApiItem {
  id: number;
  title: string;
  brand_title: string;
  price: { amount: string; currency_code: string } | string;
  size_title?: string;
  status?: string;
  description?: string;
  photos: Array<{
    url: string;
    full_size_url?: string;
    thumbnails?: Array<{ type: string; url: string }>;
  }>;
  user: {
    id: number;
    login: string;
    feedback_reputation?: number;
    given_item_count?: number;
  };
  created_at_ts?: string;
  url: string;
  path?: string;
  catalog_id?: number;
  conversion?: {
    seller_price: string;
    seller_currency: string;
    buyer_currency: string;
  };
  is_visible?: boolean;
  favourite_count?: number;
  view_count?: number;
}

/**
 * Fetch catalog items from Vinted's internal API.
 * Uses session cookies obtained via Playwright.
 * Optionally routes through a proxy (proxyUrl).
 */
export async function fetchCatalogItems(
  session: VintedSession,
  scanConfig: ScanConfig,
  page = 1,
  perPage = 96,
  proxyUrl?: string,
): Promise<RawItem[]> {
  const url = new URL(`${config.vintedDomain}/api/v2/catalog/items`);

  // Build query params
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("order", scanConfig.order || "newest_first");

  if (scanConfig.categoryIds && scanConfig.categoryIds.length > 0) {
    url.searchParams.set("catalog_ids", scanConfig.categoryIds.join(","));
  }
  if (scanConfig.brandIds && scanConfig.brandIds.length > 0) {
    url.searchParams.set("brand_ids", scanConfig.brandIds.join(","));
  }
  if (scanConfig.priceMax !== undefined) {
    url.searchParams.set("price_to", String(scanConfig.priceMax));
  }
  if (scanConfig.sizes && scanConfig.sizes.length > 0) {
    url.searchParams.set("size_ids", scanConfig.sizes.join(","));
  }
  if (scanConfig.searchText) {
    url.searchParams.set("search_text", scanConfig.searchText);
  }

  // Only fetch items in good+ condition (skip zadowalający/słaby)
  // 6=nowy z metką, 1=nowy, 2=bardzo dobry, 3=dobry
  url.searchParams.set("status_ids", "6,1,2,3");

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pl",
    "User-Agent": session.userAgent,
    Cookie: cookieHeader(session.cookies),
  };

  if (session.csrfToken) {
    headers["X-CSRF-Token"] = session.csrfToken;
  }

  // Retry with exponential backoff on 429 rate limits
  const MAX_RETRIES = 3;
  let response: Response | null = null;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await (dispatcher
      ? proxiedFetch(url.toString(), { method: "GET", headers, dispatcher }) as unknown as Response
      : fetch(url.toString(), { method: "GET", headers })
    );

    if (response.status !== 429) break;

    if (attempt < MAX_RETRIES) {
      const backoffMs = (2 ** attempt) * 5000 + Math.random() * 3000; // 5s, 13s, 29s
      logger.warn(
        { attempt: attempt + 1, backoffMs: Math.round(backoffMs), url: url.pathname },
        "429 rate limited — backing off"
      );
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  if (!response!.ok) {
    const text = await response!.text().catch(() => "");
    logger.error(
      { status: response!.status, url: url.pathname, body: text.slice(0, 500) },
      "Vinted API request failed"
    );
    throw new Error(`Vinted API ${response!.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as VintedCatalogResponse;

  if (!data.items || !Array.isArray(data.items)) {
    logger.warn({ keys: Object.keys(data) }, "Unexpected API response shape");
    return [];
  }

  return data.items.map(mapApiItemToRawItem);
}

function extractPrice(price: VintedApiItem["price"]): { amount: number; currency: string } {
  if (typeof price === "object" && price !== null && "amount" in price) {
    return {
      amount: parseFloat(price.amount) || 0,
      currency: price.currency_code || "PLN",
    };
  }
  // Fallback: price is a plain string/number
  return { amount: parseFloat(String(price)) || 0, currency: "PLN" };
}

function extractPhotoUrls(photos: VintedApiItem["photos"]): string[] {
  if (!photos || !Array.isArray(photos)) return [];
  return photos.map((p) => {
    if (p.full_size_url) return p.full_size_url;
    // Find highest-res thumbnail
    const thumb = p.thumbnails?.find((t) => t.type === "thumb150x210") || p.thumbnails?.[0];
    return thumb?.url || p.url;
  });
}

function mapApiItemToRawItem(item: VintedApiItem): RawItem {
  const { amount, currency } = extractPrice(item.price);

  return {
    vintedId: String(item.id),
    title: item.title || "",
    brand: item.brand_title || "",
    price: amount,
    currency,
    size: item.size_title || "",
    category: item.catalog_id ? String(item.catalog_id) : "",
    condition: item.status || "",
    description: item.description || "",
    photoUrls: extractPhotoUrls(item.photos),
    sellerRating: item.user?.feedback_reputation || 0,
    sellerTransactions: item.user?.given_item_count || 0,
    favouriteCount: item.favourite_count || 0,
    viewCount: item.view_count || 0,
    listedAt: item.created_at_ts || "",
    url: item.url
      ? item.url.startsWith("http")
        ? item.url
        : `${config.vintedDomain}${item.url}`
      : "",
  };
}

/**
 * Check if a Vinted item is still available (not sold/removed).
 * Makes a HEAD request to the item URL — sold items return 301/302 to a "sold" page or 404.
 */
export async function checkItemAvailable(itemUrl: string, session: VintedSession, proxyUrl?: string): Promise<boolean> {
  try {
    // Use Vinted's item API endpoint if we can extract the ID
    const idMatch = itemUrl.match(/\/(\d+)-/);
    if (!idMatch) return true; // Can't parse — assume still available

    const apiUrl = `${config.vintedDomain}/api/v2/items/${idMatch[1]}`;
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    const response = dispatcher
      ? await proxiedFetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": session.userAgent,
            Cookie: cookieHeader(session.cookies),
          },
          redirect: "manual",
          dispatcher,
        }) as unknown as Response
      : await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": session.userAgent,
            Cookie: cookieHeader(session.cookies),
          },
          redirect: "manual",
        });

    // Only treat 404 as "gone". Rate limits (429), server errors (5xx) = assume available
    if (response.status === 404) return false;
    if (!response.ok) return true;

    const data = await response.json() as any;
    const item = data?.item;
    if (!item) return true; // Missing data — don't mark as sold

    // Only trust explicit "sold" status, not is_closed (could be editing/paused)
    if (item.status === "sold") return false;

    return true;
  } catch {
    return true; // Network error — assume still available
  }
}
