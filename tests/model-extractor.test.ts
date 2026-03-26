import { describe, it, expect } from "vitest";
import { extractModel } from "../src/model-extractor.js";

// ============================================================
// Model extraction — Nike
// ============================================================
describe("extractModel — Nike", () => {
  it("extracts Air Max 90", () => {
    expect(extractModel("Nike", "Nike Air Max 90 rozmiar 43")).toBe("air max 90");
  });
  it("extracts Air Force 1", () => {
    expect(extractModel("Nike", "nike air force 1 low white")).toBe("air force 1");
  });
  it("extracts Dunk Low", () => {
    expect(extractModel("Nike", "Nike Dunk Low Retro rozmiar 42")).toBe("dunk low");
  });
  it("extracts Blazer Mid", () => {
    expect(extractModel("Nike", "Nike Blazer Mid '77")).toBe("blazer mid");
  });
  it("extracts Tech Fleece", () => {
    expect(extractModel("Nike", "Spodnie Nike Tech Fleece szare L")).toBe("tech fleece");
  });
  it("returns empty for generic title", () => {
    expect(extractModel("Nike", "Nike buty sportowe")).toBe("");
  });
});

// ============================================================
// Model extraction — Adidas
// ============================================================
describe("extractModel — Adidas", () => {
  it("extracts Samba", () => {
    expect(extractModel("Adidas", "Adidas Samba OG White")).toBe("samba og");
  });
  it("extracts Gazelle", () => {
    expect(extractModel("Adidas", "adidas Gazelle Bold")).toBe("gazelle bold");
  });
  it("extracts Superstar", () => {
    expect(extractModel("Adidas", "Adidas Superstar 42")).toBe("superstar");
  });
  it("extracts Campus", () => {
    expect(extractModel("Adidas", "adidas Campus 00s")).toBe("campus 00s");
  });
  it("extracts Handball Spezial", () => {
    expect(extractModel("Adidas", "Adidas Handball Spezial")).toBe("handball spezial");
  });
});

// ============================================================
// Model extraction — New Balance
// ============================================================
describe("extractModel — New Balance", () => {
  it("extracts 574", () => {
    expect(extractModel("New Balance", "New Balance 574 szare")).toBe("574");
  });
  it("extracts 990v6", () => {
    expect(extractModel("New Balance", "NB 990v6 USA")).toBe("990v6");
  });
  it("extracts 550", () => {
    expect(extractModel("New Balance", "New Balance 550 białe 43")).toBe("550");
  });
  it("extracts 2002r", () => {
    expect(extractModel("New Balance", "New Balance 2002r Protection Pack")).toBe("2002r");
  });
});

// ============================================================
// Model extraction — The North Face
// ============================================================
describe("extractModel — The North Face", () => {
  it("extracts 1996 Retro", () => {
    expect(extractModel("The North Face", "The North Face 1996 Retro Nuptse")).toMatch(/1996/);
  });
  it("extracts Nuptse", () => {
    expect(extractModel("The North Face", "TNF Nuptse 700")).toBe("nuptse 700");
  });
  it("extracts Denali", () => {
    expect(extractModel("The North Face", "The North Face Denali 2 Fleece")).toBe("denali 2");
  });
});

// ============================================================
// Model extraction — Salomon
// ============================================================
describe("extractModel — Salomon", () => {
  it("extracts XT-6", () => {
    expect(extractModel("Salomon", "Salomon XT-6 42")).toBe("xt-6");
  });
  it("extracts Speedcross 6", () => {
    expect(extractModel("Salomon", "Salomon Speedcross 6 trail")).toBe("speedcross 6");
  });
});

// ============================================================
// Model extraction — edge cases
// ============================================================
describe("extractModel — edge cases", () => {
  it("returns empty for unknown brand", () => {
    expect(extractModel("RandomBrand", "Some random item")).toBe("");
  });
  it("returns empty for empty brand", () => {
    expect(extractModel("", "Nike Air Max 90")).toBe("");
  });
  it("is case-insensitive on brand", () => {
    expect(extractModel("NIKE", "Nike Air Max 90")).toBe("air max 90");
  });
  it("returns empty when no model pattern matches", () => {
    expect(extractModel("Nike", "Koszulka Nike rozmiar M")).toBe("");
  });
});
