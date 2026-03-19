import type { RawItem, PriceSignal, AiAnalysis } from "../src/types.js";

/** Create a mock RawItem with sensible defaults — override any field */
export function mockItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    vintedId: "test-1",
    title: "Nike Air Max 90",
    brand: "Nike",
    price: 100,
    currency: "PLN",
    size: "42",
    category: "shoes",
    condition: "Bardzo dobry",
    description: "Buty w dobrym stanie",
    photoUrls: ["https://example.com/photo.jpg"],
    sellerRating: 4.5,
    sellerTransactions: 10,
    favouriteCount: 0,
    viewCount: 0,
    listedAt: "2026-03-15",
    url: "https://www.vinted.pl/items/test-1",
    ...overrides,
  };
}

/** Create a mock PriceSignal */
export function mockSignal(overrides: Partial<PriceSignal> = {}): PriceSignal {
  return {
    discountPct: 50,
    isUnderpriced: true,
    confidence: 0.8,
    sampleSize: 30,
    medianPrice: 200,
    p25Price: 150,
    priceDiscountScore: 5,
    ...overrides,
  };
}

/** Create a mock AiAnalysis */
export function mockAi(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    resalePotential: 7,
    conditionConfidence: 7,
    brandLiquidity: 7,
    estimatedProfit: 80,
    suggestedPrice: 180,
    riskFlags: [],
    reasoning: "Dobra okazja",
    ...overrides,
  };
}
