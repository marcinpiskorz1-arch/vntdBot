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
  category: { id: number; type: string };
  delivery?: { rock?: { active: boolean; mode: string } };
  user: {
    id: number;
    name: string;
    created: string;
  };
  created_time: string;
  last_refresh_time: string;
}

interface OlxParam {
  key: string;
  name: string;
  type: string;
  value: { key?: string; label?: string; value?: number; currency?: string; type?: string };
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

/**
 * Fetch offers from OLX.pl public API.
 * No category filter — query text handles relevance.
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

  // Price is inside the params array (key: "price")
  const priced = data.data.filter((o) => {
    const pp = o.params.find((p) => p.key === "price");
    return pp?.value?.type === "price" && pp.value.value != null && pp.value.value > 0;
  });

  return priced.map(mapOlxToRawItem);
}

function extractParam(params: OlxParam[], key: string): string {
  const p = params.find((p) => p.key === key);
  return p?.value?.label || "";
}

function mapOlxToRawItem(offer: OlxOffer): RawItem {
  const condition = extractParam(offer.params, "state");
  const size = extractParam(offer.params, "size");

  // Brand param is "fashionbrand" on OLX (not "brand")
  const brand = extractParam(offer.params, "fashionbrand") || "";

  // Price is in params array
  const priceParam = offer.params.find((p) => p.key === "price");
  const price = priceParam?.value?.value || 0;
  const currency = priceParam?.value?.currency || "PLN";

  // Photos have template URLs — resolve to 800x600
  const photoUrls = (offer.photos || []).map(
    (p) => p.link.replace("{width}", "800").replace("{height}", "600")
  );

  // Detect shipping from delivery.rock
  const hasShipping = offer.delivery?.rock?.active === true;

  return {
    vintedId: `olx_${offer.id}`,
    title: offer.title || "",
    brand,
    price,
    currency,
    size,
    category: String(offer.category?.id || ""),
    condition: condition || "Brak informacji",
    description: (hasShipping ? "" : "[TYLKO ODBIÓR OSOBISTY] ") + (offer.description || ""),
    photoUrls,
    sellerRating: 0, // OLX doesn't expose rating in search API
    sellerTransactions: 0,
    listedAt: offer.created_time || "",
    url: offer.url || "",
  };
}
