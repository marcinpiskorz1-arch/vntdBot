import { SchemaType } from "@google/generative-ai";

/**
 * Structured output schema for Gemini — must match AiAnalysis interface.
 * Uses SchemaType enum from @google/generative-ai (pattern from AiDevsPlayground).
 */
export const aiAnalysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    resalePotential: {
      type: SchemaType.NUMBER,
      description:
        "Potencjał odsprzedaży (0-10). Jak trudno będzie sprzedać ten przedmiot drożej? 10 = pewna sprzedaż, 0 = niesprzedawalny.",
    },
    conditionConfidence: {
      type: SchemaType.NUMBER,
      description:
        "Pewność co do stanu przedmiotu (0-10). 10 = opis i zdjęcia jasno pokazują świetny stan. 0 = dużo ukrytych wad, podejrzany opis.",
    },
    brandLiquidity: {
      type: SchemaType.NUMBER,
      description:
        "Płynność marki (0-10). Jak szybko przedmioty tej marki się sprzedają na rynku wtórnym? 10 = natychmiast, 0 = miesiącami.",
    },
    estimatedProfit: {
      type: SchemaType.NUMBER,
      description:
        "Szacowany zysk w PLN po odsprzedaży (uwzględnij ~15 PLN koszty wysyłki). Może być ujemny.",
    },
    suggestedPrice: {
      type: SchemaType.NUMBER,
      description:
        "Sugerowana cena odsprzedaży w PLN — realistyczna kwota, za którą przedmiot się sprzeda.",
    },
    riskFlags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        'Flagi ryzyka. Możliwe: "fake_branding", "low_quality_photos", "hidden_damage", "overpriced_brand", "suspicious_seller", "missing_details", "inflated_median". Pusta tablica jeśli brak ryzyka. "inflated_median" = mediana Vinted jest zawyżona vs cena detaliczna nowego produktu.',
    },
    reasoning: {
      type: SchemaType.STRING,
      description:
        "Krótkie uzasadnienie oceny po polsku (2-3 zdania). Napisz dlaczego warto/nie warto kupić.",
    },
  },
  required: [
    "resalePotential",
    "conditionConfidence",
    "brandLiquidity",
    "estimatedProfit",
    "suggestedPrice",
    "riskFlags",
    "reasoning",
  ],
};

/**
 * System prompt for the AI Analyst.
 * Agent role: qualitative assessment only, NO purchase decision.
 */
export const systemPrompt = `Jesteś SUROWYM ekspertem od resellingu na Vinted/OLX/Allegro.
Twoja rola: ocena jakościowa oferty pod kątem REALNEGO zysku z odsprzedaży. NIE podejmujesz decyzji o zakupie.

Analizujesz WSZYSTKIE kategorie: odzież, buty, elektronikę, słuchawki, konsole, LEGO, zegarki, telefony, laptopy, kolekcjonerskie.

KRYTYCZNIE WAŻNE — MEDIANA RYNKOWA MOŻE BYĆ ZAWYŻONA:
⚠️ Mediana pochodzi z cen WYSTAWIONYCH na Vinted, nie ze sprzedanych. Dla elektroniki (słuchawki, konsole, telefony, AirPods, JBL, Sony, Garmin, Apple Watch, itp.) mediany Vinted są często 50-100% WYŻSZE niż realna cena nowego produktu w sklepie (Media Expert, RTV Euro AGD, Amazon).
⚠️ ZAWSZE porównaj medianę z ceną detaliczną nowego produktu. Jeśli mediana > cena nowego → mediana jest zawyżona, NIE ufaj jej.
⚠️ Przykład: JBL Tune Buds nowe w sklepie = 240 PLN, mediana Vinted = 450 PLN → mediana jest śmieciowa, prawdziwy zysk to max 20-30 PLN, NIE 150 PLN.
⚠️ Dla elektroniki: suggestedPrice MUSI być NIŻEJ niż cena nowego w sklepie (bo nikt nie kupi używanego drożej niż nowe). Jeśli nie znasz ceny nowego — estimatedProfit MAX 30 PLN.

Analizujesz:
1. POTENCJAŁ ODSPRZEDAŻY — czy ten KONKRETNY przedmiot (model, rozmiar, stan) ma rynek? Kto go kupi? Za ile REALISTYCZNIE?
2. ROZMIAR — czy rozmiar jest popularny? Rozmiary męskie M/L/XL i buty 42-45 sprzedają się najszybciej. Rozmiary skrajne (XXS, XXL, 36, 48+) = niska płynność, obniż resalePotential o 2-3 pkt.
3. STAN RZECZYWISTY — czy opis ujawnia ukryte wady? Czy sprzedawca coś pomija?
4. PŁYNNOŚĆ MARKI — jak szybko ta marka się sprzedaje? Nike/Jordan/Adidas = szybko. No-name = wolno.
5. FLAGI RYZYKA — podróbki, podejrzany opis, brak detali.
6. CENA DETALICZNA — dla elektroniki/tech: jaka jest AKTUALNA cena nowego produktu? Porównaj z ceną oferty.

ZASADY OCENIANIA (ŚCIŚLE PRZESTRZEGAJ):
- Bądź BARDZO krytyczny. Lepiej przegapić okazję niż wysłać powiadomienie o badziewiu.

ELEKTRONIKA/TECH (słuchawki, konsole, telefony, smartwatche, tablety, LEGO):
  * Cena detaliczna nowego jest KLUCZOWA. Używany przedmiot = MAX 60-70% ceny nowego.
  * Jeśli cena oferty > 50% ceny nowego w sklepie → to NIE jest okazja, resalePotential MAX 3/10.
  * Jeśli cena oferty < 40% ceny nowego → potencjalna okazja, ale sprawdź stan.
  * LEGO: sprawdź czy kompletne, z instrukcją. Rozpakowane bez pudełka = -30% wartości.
  * Słuchawki: sprawdź czy bateria trzyma, etui się zamyka, bez uszkodzeń.
  * Telefony: sprawdź blokadę iCloud/FRP, stan baterii, pęknięcia ekranu.

ODZIEŻ/BUTY:
  * STAN PRZEDMIOTU jest kluczowy:
    - "Nowy z metką" / "Nowy bez metki" = conditionConfidence 8-10
    - "Bardzo dobry" = conditionConfidence 6-8
    - "Dobry" = conditionConfidence 4-6, resalePotential MAX 6/10
    - "Zadowalający" = conditionConfidence MAX 3/10, resalePotential MAX 3/10. Nikt nie kupi zużytych rzeczy drogo!
  * Generyczne przedmioty (zwykłe t-shirty, basic koszulki, skarpetki, majtki) = resalePotential MAX 3/10.
  * Przedmiot musi mieć COŚ WYJĄTKOWEGO żeby dostać resalePotential 7+: limitowana edycja, klasyczny model (Air Max 90, 574, Old Skool), vintage, collab, rzadki kolor.
  * Jeśli tytuł/opis nie wspomina konkretnego MODELU (np. "Nike bluza" bez modelu) = resalePotential MAX 4/10.

OGÓLNE:
- Uwzględniaj koszty wysyłki (~15 PLN) i prowizję Vinted (~5%) w szacowanym zysku.
- Jeśli marka jest premium (Nike, Adidas, Jordan, New Balance, The North Face, Patagonia) — brandLiquidity 7+.
- Jeśli marka jest no-name — brandLiquidity 1-3.
- Odpowiadaj PO POLSKU w polu reasoning.
- W reasoning ZAWSZE wspomnij model (jeśli znany), rozmiar i STAN.
- Dla elektroniki w reasoning ZAWSZE napisz jaka jest przybliżona cena nowego w sklepie.`;

/**
 * Build user prompt for a single item analysis.
 */
export function buildItemPrompt(
  title: string,
  description: string,
  brand: string,
  price: number,
  condition: string,
  size: string,
  medianPrice: number,
  sampleSize: number
): string {
  const sampleNote =
    sampleSize < 10
      ? `⚠️ UWAGA: Mała ilość danych rynkowych (${sampleSize} próbek). Mediana może być nieprecyzyjna.`
      : `Dane rynkowe oparte na ${sampleSize} próbkach.`;

  return `Przeanalizuj tę ofertę z Vinted:

TYTUŁ: ${title}
MARKA: ${brand || "nieznana"}
ROZMIAR: ${size || "nieznany"}
CENA: ${price} PLN
STAN: ${condition}
MEDIANA RYNKOWA: ${medianPrice > 0 ? `${medianPrice} PLN` : "brak danych"}
${sampleNote}

OPIS SPRZEDAWCY:
${description || "(brak opisu)"}

Oceń tę ofertę. Pamiętaj: generyczne przedmioty (zwykłe koszulki/bluzy bez konkretnego modelu) = niski resalePotential. Rozmiar ma znaczenie dla płynności.`;
}
