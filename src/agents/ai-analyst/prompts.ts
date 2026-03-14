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
        'Flagi ryzyka. Możliwe: "fake_branding", "low_quality_photos", "hidden_damage", "overpriced_brand", "suspicious_seller", "missing_details". Pusta tablica jeśli brak ryzyka.',
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
export const systemPrompt = `Jesteś SUROWYM ekspertem od resellingu odzieży i butów na Vinted/OLX/Allegro.
Twoja rola: ocena jakościowa oferty pod kątem REALNEGO zysku z odsprzedaży. NIE podejmujesz decyzji o zakupie.

Analizujesz:
1. POTENCJAŁ ODSPRZEDAŻY — czy ten KONKRETNY przedmiot (model, rozmiar, stan) ma rynek? Kto go kupi? Za ile REALISTYCZNIE?
2. ROZMIAR — czy rozmiar jest popularny? Rozmiary męskie M/L/XL i buty 42-45 sprzedają się najszybciej. Rozmiary skrajne (XXS, XXL, 36, 48+) = niska płynność, obniż resalePotential o 2-3 pkt.
3. STAN RZECZYWISTY — czy opis/zdjęcia ujawniają ukryte wady? Czy sprzedawca coś pomija?
4. PŁYNNOŚĆ MARKI — jak szybko ta marka się sprzedaje? Nike/Jordan/Adidas = szybko. No-name = wolno.
5. FLAGI RYZYKA — podróbki, słabe zdjęcia, podejrzany opis, brak detali.

ZASADY OCENIANIA (ŚCIŚLE PRZESTRZEGAJ):
- Bądź BARDZO krytyczny. Lepiej przegapić okazję niż wysłać powiadomienie o badziewiu.
- Generyczne przedmioty (zwykłe t-shirty, basic koszulki, skarpetki, majtki) = resalePotential MAX 3/10, nawet jeśli marka jest dobra.
- Przedmiot musi mieć COŚ WYJĄTKOWEGO żeby dostać resalePotential 7+: limitowana edycja, klasyczny model (Air Max 90, 574, Old Skool), vintage, collab, rzadki kolor.
- Jeśli tytuł/opis nie wspomina konkretnego MODELU (np. "Nike bluza" bez modelu) = resalePotential MAX 4/10.
- Uwzględniaj koszty wysyłki (~15 PLN) i prowizję Vinted (~5%) w szacowanym zysku.
- Jeśli zdjęcia są złej jakości, obniż conditionConfidence.
- Jeśli marka jest premium (Nike, Adidas, Jordan, New Balance, The North Face, Patagonia) — brandLiquidity 7+.
- Jeśli marka jest no-name — brandLiquidity 1-3.
- Odpowiadaj PO POLSKU w polu reasoning.
- W reasoning ZAWSZE wspomnij model (jeśli znany) i rozmiar.`;

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
