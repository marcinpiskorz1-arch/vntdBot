// ============================================================
// VintedBot — All shared type contracts (agents communicate via these)
// ============================================================

/** Input do Scraper Agent — co skanować */
export interface ScanConfig {
  categoryIds?: number[];
  brandIds?: number[];
  priceMax?: number;
  sizes?: string[];
  searchText?: string;
  priority?: boolean; // scanned every cycle (vs every other cycle for standard)
}

/** Scraper → Pricing: surowa oferta z Vinted */
export interface RawItem {
  vintedId: string;
  title: string;
  brand: string;
  model?: string;
  price: number;
  currency: string;
  size?: string;
  category: string;
  condition: string;
  description: string;
  photoUrls: string[];
  sellerRating: number;
  sellerTransactions: number;
  listedAt: string;
  url: string;
}

/** Pricing → AI Analyst: sygnał cenowy */
export interface PriceSignal {
  discountPct: number;        // (1 - price/median) * 100
  isUnderpriced: boolean;     // discountPct >= threshold
  confidence: number;         // 0-1, based on sampleSize
  sampleSize: number;
  medianPrice: number;
  p25Price: number;
  priceDiscountScore: number; // 0-10, capped
}

/** AI Analyst → Decision: analiza jakościowa z Gemini */
export interface AiAnalysis {
  resalePotential: number;     // 0-10 (waga 0.3 w scoringu)
  conditionConfidence: number; // 0-10 (waga 0.2)
  brandLiquidity: number;     // 0-10 (waga 0.1)
  estimatedProfit: number;    // PLN
  suggestedPrice: number;     // PLN
  riskFlags: string[];        // ["fake_branding", "low_quality_photos", ...]
  reasoning: string;          // po polsku
}

/** Decision → Telegram: finalna decyzja */
export interface Decision {
  score: number;              // 0-10 weighted
  level: "ignore" | "notify" | "hot";
  reasons: string[];
  item: RawItem;
  pricing: PriceSignal;
  ai: AiAnalysis;
}

/** Telegram formatting: pre-sformatowany payload */
export interface NotificationPayload {
  photoUrl: string;
  title: string;
  priceLine: string;          // "45 PLN (mediana: 120 PLN, -63%)"
  scoreLine: string;          // "⭐ 8.2 / 10 — HOT DEAL"
  profitLine: string;         // "💰 Szacowany zysk: ~75 PLN"
  aiReasoning: string;
  riskFlags: string[];
  vintedUrl: string;
  scoreBreakdown: string;     // for "Dlaczego hot?" callback
  itemId: string;
}
