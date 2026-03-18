import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required env var: ${name}`);
    console.error(`   Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  // Gemini (optional — only needed when ai_enabled = true)
  geminiApiKey: optionalEnv("GEMINI_API_KEY", ""),
  geminiModel: optionalEnv("GEMINI_MODEL", "gemini-2.5-flash"),

  // Telegram
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  telegramChatId: requireEnv("TELEGRAM_CHAT_ID"),

  // Proxy (comma-separated, optional)
  proxyUrls: (process.env["PROXY_URLS"] || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),

  // Scan settings
  scanIntervalMs: parseInt(optionalEnv("SCAN_INTERVAL_MS", "30000"), 10),
  dealThreshold: parseFloat(optionalEnv("DEAL_THRESHOLD", "0.60")),

  // Vinted
  vintedDomain: optionalEnv("VINTED_DOMAIN", "https://www.vinted.pl"),

  // Scoring
  weights: {
    priceDiscount: 0.4,
    resalePotential: 0.3,
    conditionConfidence: 0.2,
    brandLiquidity: 0.1,
  },
  notifyThreshold: 4.5,
  hotThreshold: 9.0,
  hotMinProfit: 50, // PLN
  lowSamplePenalty: 0.90, // applied when sampleSize < 10

  // Paths
  dbPath: optionalEnv("DB_PATH", "data/vintedbot.db"),
} as const;
