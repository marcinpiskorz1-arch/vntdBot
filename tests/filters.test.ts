import { describe, it, expect } from "vitest";
import {
  isAboveMinPrice,
  isNotKidsItem,
  isNotHat,
  isGoodCondition,
  isShippable,
  filterItems,
} from "../src/filters.js";
import { mockItem } from "./helpers.js";

// ============================================================
// isAboveMinPrice
// ============================================================
describe("isAboveMinPrice", () => {
  it("keeps items at or above min price", () => {
    expect(isAboveMinPrice(mockItem({ price: 20 }), 20)).toBe(true);
    expect(isAboveMinPrice(mockItem({ price: 100 }), 20)).toBe(true);
  });

  it("rejects items below min price", () => {
    expect(isAboveMinPrice(mockItem({ price: 19 }), 20)).toBe(false);
    expect(isAboveMinPrice(mockItem({ price: 0 }), 20)).toBe(false);
  });
});

// ============================================================
// isNotKidsItem
// ============================================================
describe("isNotKidsItem", () => {
  it("keeps normal adult items", () => {
    expect(isNotKidsItem(mockItem())).toBe(true);
  });

  it("filters items with 'kids' in title", () => {
    expect(isNotKidsItem(mockItem({ title: "Nike kids shoes" }))).toBe(false);
  });

  it("filters items with 'dziecięce' in description", () => {
    expect(isNotKidsItem(mockItem({ description: "Buty dziecięce rozmiar 28" }))).toBe(false);
  });

  it("filters items with 'enfant' in title", () => {
    expect(isNotKidsItem(mockItem({ title: "Chaussures enfant Nike" }))).toBe(false);
  });

  it("filters items with 'baby' in title", () => {
    expect(isNotKidsItem(mockItem({ title: "Baby Nike sneakers" }))).toBe(false);
  });

  it("filters items with 'toddler' in title", () => {
    expect(isNotKidsItem(mockItem({ title: "Toddler Jordan 4" }))).toBe(false);
  });

  it("filters items in kids category", () => {
    expect(isNotKidsItem(mockItem({ category: "Enfants" }))).toBe(false);
    expect(isNotKidsItem(mockItem({ category: "Dzieci" }))).toBe(false);
    expect(isNotKidsItem(mockItem({ category: "Kids" }))).toBe(false);
    expect(isNotKidsItem(mockItem({ category: "Kinder" }))).toBe(false);
  });

  it("filters shoes with kids sizes (16-33)", () => {
    expect(isNotKidsItem(mockItem({ title: "Nike buty", size: "28" }))).toBe(false);
    expect(isNotKidsItem(mockItem({ title: "Adidas sneaker", size: "33" }))).toBe(false);
    expect(isNotKidsItem(mockItem({ title: "Nike shoe", size: "16" }))).toBe(false);
  });

  it("keeps shoes with adult sizes", () => {
    expect(isNotKidsItem(mockItem({ title: "Nike buty", size: "42" }))).toBe(true);
    expect(isNotKidsItem(mockItem({ title: "Nike shoe", size: "34" }))).toBe(true);
  });

  it("does NOT filter non-shoe items with small sizes", () => {
    // Size 28 for a jacket is fine — only shoe items get size-filtered
    expect(isNotKidsItem(mockItem({
      title: "Kurtka Nike",
      description: "Ciepła kurtka",
      category: "jackets",
      size: "28",
    }))).toBe(true);
  });
});

// ============================================================
// isNotHat
// ============================================================
describe("isNotHat", () => {
  it("keeps normal items", () => {
    expect(isNotHat(mockItem())).toBe(true);
  });

  it("filters beanies", () => {
    expect(isNotHat(mockItem({ title: "Nike beanie czarny" }))).toBe(false);
  });

  it("filters czapki", () => {
    expect(isNotHat(mockItem({ title: "Czapka zimowa Adidas" }))).toBe(false);
  });

  it("filters hats", () => {
    expect(isNotHat(mockItem({ title: "Nike bucket hat" }))).toBe(false);
  });

  it("filters bonnets", () => {
    expect(isNotHat(mockItem({ title: "Bonnet enfant" }))).toBe(false);
  });

  it("filters berets", () => {
    expect(isNotHat(mockItem({ title: "Beret wełniany" }))).toBe(false);
  });
});

// ============================================================
// isGoodCondition
// ============================================================
describe("isGoodCondition", () => {
  it("keeps items in good condition", () => {
    expect(isGoodCondition(mockItem({ condition: "Dobry" }))).toBe(true);
    expect(isGoodCondition(mockItem({ condition: "Bardzo dobry" }))).toBe(true);
    expect(isGoodCondition(mockItem({ condition: "Nowy" }))).toBe(true);
  });

  it("filters satisfactory condition", () => {
    expect(isGoodCondition(mockItem({ condition: "Zadowalający" }))).toBe(false);
    expect(isGoodCondition(mockItem({ condition: "satisfactory" }))).toBe(false);
  });

  it("filters poor condition", () => {
    expect(isGoodCondition(mockItem({ condition: "poor" }))).toBe(false);
    expect(isGoodCondition(mockItem({ condition: "słaby" }))).toBe(false);
  });

  it("filters acceptable condition", () => {
    expect(isGoodCondition(mockItem({ condition: "acceptable" }))).toBe(false);
  });
});

// ============================================================
// isShippable
// ============================================================
describe("isShippable", () => {
  it("keeps normal items", () => {
    expect(isShippable(mockItem())).toBe(true);
  });

  it("filters pickup-only items", () => {
    expect(isShippable(mockItem({ description: "Tylko odbiór osobisty Kraków" }))).toBe(false);
    expect(isShippable(mockItem({ description: "Nie wysyłam, odbiór osobisty" }))).toBe(false);
  });

  it("keeps items that mention shipping", () => {
    expect(isShippable(mockItem({ description: "Wysyłka InPost paczkomat" }))).toBe(true);
  });
});

// ============================================================
// filterItems (integration)
// ============================================================
describe("filterItems", () => {
  it("passes through valid items", () => {
    const items = [mockItem(), mockItem({ vintedId: "test-2" })];
    const result = filterItems(items, 20);
    expect(result.passed).toHaveLength(2);
    expect(result.removed).toBe(0);
  });

  it("filters multiple categories correctly", () => {
    const items = [
      mockItem({ price: 5 }),                                      // too cheap
      mockItem({ vintedId: "2", title: "Nike kids shoes" }),        // kids
      mockItem({ vintedId: "3", title: "Nike beanie" }),            // hat
      mockItem({ vintedId: "4", condition: "poor" }),               // bad condition
      mockItem({ vintedId: "5", description: "Nie wysyłam" }),      // pickup only
      mockItem({ vintedId: "6", price: 100 }),                     // should pass
    ];

    const result = filterItems(items, 20);
    expect(result.passed).toHaveLength(1);
    expect(result.passed[0].vintedId).toBe("6");
    expect(result.breakdown.priceTooLow).toBe(1);
    expect(result.breakdown.kids).toBe(1);
    expect(result.breakdown.hats).toBe(1);
    expect(result.breakdown.badCondition).toBe(1);
    expect(result.breakdown.pickupOnly).toBe(1);
  });

  it("returns correct removed count", () => {
    const items = [
      mockItem({ price: 5 }),
      mockItem({ vintedId: "2", price: 100 }),
    ];
    const result = filterItems(items, 20);
    expect(result.removed).toBe(1);
    expect(result.passed).toHaveLength(1);
  });
});
