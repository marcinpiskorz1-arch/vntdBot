import { describe, it, expect } from "vitest";
import {
  isAboveMinPrice,
  isNotKidsItem,
  isNotHat,
  isGoodCondition,
  isShippable,
  isNotJunk,
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
  it("keeps very good and new condition", () => {
    expect(isGoodCondition(mockItem({ condition: "Bardzo dobry" }))).toBe(true);
    expect(isGoodCondition(mockItem({ condition: "Very good" }))).toBe(true);
    expect(isGoodCondition(mockItem({ condition: "Nowy" }))).toBe(true);
    expect(isGoodCondition(mockItem({ condition: "Nowy z metką" }))).toBe(true);
  });

  it("filters good/dobry condition", () => {
    expect(isGoodCondition(mockItem({ condition: "Dobry" }))).toBe(false);
    expect(isGoodCondition(mockItem({ condition: "good" }))).toBe(false);
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
// isNotJunk
// ============================================================
describe("isNotJunk", () => {
  it("filters phone/tablet cases", () => {
    expect(isNotJunk(mockItem({ title: "iPhone 15 case silicone" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Etui na Nintendo Switch" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Samsung Galaxy S24 cover" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Pokrowiec na laptop" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Obudowa iPhone 14" }))).toBe(false);
  });

  it("filters screen protectors", () => {
    expect(isNotJunk(mockItem({ title: "Szkiełko hartowane iPhone 15" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Tempered glass Samsung" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Folia ochronna iPad" }))).toBe(false);
  });

  it("filters cables and chargers", () => {
    expect(isNotJunk(mockItem({ title: "Kabel Lightning USB-C" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Ładowarka iPhone" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Charger Samsung 25W" }))).toBe(false);
  });

  it("filters watch straps and bands", () => {
    expect(isNotJunk(mockItem({ title: "Pasek do G-Shock" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Watch band Seiko" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Remień do zegarka" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Remien skórzany" }))).toBe(false);
  });

  it("filters instructions, socks, keychains, belts", () => {
    expect(isNotJunk(mockItem({ title: "LEGO Technic instrukcja" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Skarpetki Nike 3-pack" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Brelok Supreme" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Sznurówki Jordan" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Naszywka Adidas" }))).toBe(false);
    expect(isNotJunk(mockItem({ title: "Off white belt" }))).toBe(false);
  });

  it("keeps actual products", () => {
    expect(isNotJunk(mockItem({ title: "Nintendo Switch OLED" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "iPhone 15 Pro 256GB" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "Nike Air Force 1" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "Sony WH-1000XM5" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "G-Shock GA-2100" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "LEGO Technic 42143" }))).toBe(true);
    expect(isNotJunk(mockItem({ title: "Levi's 501 jeansy" }))).toBe(true);
  });
});

// ============================================================
// filterItems (integration)
// ============================================================
describe("filterItems", () => {
  it("passes through valid items", () => {
    const items = [mockItem({ price: 100 }), mockItem({ vintedId: "test-2", price: 100 })];
    const result = filterItems(items, 49);
    expect(result.passed).toHaveLength(2);
    expect(result.removed).toBe(0);
  });

  it("filters multiple categories correctly", () => {
    const items = [
      mockItem({ price: 5 }),                                      // too cheap
      mockItem({ vintedId: "2", title: "Nike kids shoes" }),        // kids
      mockItem({ vintedId: "3", title: "Nike beanie" }),            // hat
      mockItem({ vintedId: "4", condition: "poor" }),               // bad condition
      mockItem({ vintedId: "5", title: "iPhone case silicone" }),   // junk
      mockItem({ vintedId: "6", description: "Nie wysyłam" }),      // pickup only
      mockItem({ vintedId: "7", price: 100 }),                     // should pass
    ];

    const result = filterItems(items, 49);
    expect(result.passed).toHaveLength(1);
    expect(result.passed[0].vintedId).toBe("7");
    expect(result.breakdown.priceTooLow).toBe(1);
    expect(result.breakdown.kids).toBe(1);
    expect(result.breakdown.hats).toBe(1);
    expect(result.breakdown.badCondition).toBe(1);
    expect(result.breakdown.junk).toBe(1);
    expect(result.breakdown.pickupOnly).toBe(1);
  });

  it("returns correct removed count", () => {
    const items = [
      mockItem({ price: 5 }),
      mockItem({ vintedId: "2", price: 100 }),
    ];
    const result = filterItems(items, 49);
    expect(result.removed).toBe(1);
    expect(result.passed).toHaveLength(1);
  });
});
