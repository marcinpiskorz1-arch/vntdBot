import { logger } from "../../logger.js";
import type { RawItem, ScanConfig } from "../../types.js";

// OLX API response shapes
interface OlxResponse {
  data: OlxOffer[];
}

interface OlxOffer {
  id: number;
  url: string;
  title: string;
  description: string;
  params: OlxParam[];
  photos: Array<{ link: string }>;
  price: {
    value: number | null;
    currency: string;
    type: string; // "price", "exchange", "free"
    negotiable: boolean;
  };
  user: {
    id: number;
    name: string;
    created: string;
  };
  created_time: string;
  last_refresh_time: string;
  category_id: number;
}

interface OlxParam {
  key: string;
  name: string;
  value: { key?: string; label: string };
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

// OLX Fashion category = 1604
const OLX_FASHION_CATEGORY = 1604;

/**
 * Fetch offers from OLX.pl public API.
 */
export async function fetchOlxOffers(
  scanConfig: ScanConfig,
  offset = 0,
  limit = 40,
): Promise<RawItem[]> {
  const url = new URL("https://www.olx.pl/api/v1/offers/");

  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort_by", "created_at:desc");
  url.searchParams.set("category_id", String(OLX_FASHION_CATEGORY));

  if (scanConfig.searchText) {
    url.searchParams.set("query", scanConfig.searchText);
  }
  if (scanConfig.priceMax !== undefined) {
    url.searchParams.set("filter_float_price:to", String(scanConfig.priceMax));
  }

  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Language": "pl",
      "User-Agent": ua,
      Referer: "https://www.olx.pl/",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.error(
      { status: response.status, url: url.pathname, body: text.slice(0, 500) },
      "OLX API request failed",
    );
    throw new Error(`OLX API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as OlxResponse;

  if (!data.data || !Array.isArray(data.data)) {
    logger.warn({ keys: Object.keys(data) }, "Unexpected OLX API response shape");
    return [];
  }

  // Filter: only items with a price (skip "exchange" or "free")
  const priced = data.data.filter(
    (o) => o.price?.type === "price" && o.price.value != null && o.price.value > 0,
  );

  return priced.map(mapOlxToRawItem);
}

function extractParam(params: OlxParam[], key: string): string {
  const p = params.find((p) => p.key === key);
  return p?.value?.label || "";
}

function mapOlxToRawItem(offer: OlxOffer): RawItem {
  const condition = extractParam(offer.params, "state");
  const size = extractParam(offer.params, "size");

  // Try to extract brand from title (first word that looks like a brand)
  const brand = extractParam(offer.params, "brand") || "";

  return {
    vintedId: `olx_${offer.id}`,
    title: offer.title || "",
    brand,
    price: offer.price.value || 0,
    currency: offer.price.currency || "PLN",
    size,
    category: String(offer.category_id || ""),
    condition: condition || "Brak informacji",
    description: offer.description || "",
    photoUrls: (offer.photos || []).map((p) => p.link),
    sellerRating: 0, // OLX doesn't expose rating in search API
    sellerTransactions: 0,
    listedAt: offer.created_time || "",
    url: offer.url || "",
  };
}
