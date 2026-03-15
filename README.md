# VintedBot — Deal Sniper

Autonomous deal-hunting bot that continuously monitors **Vinted** and **OLX.pl** for underpriced items, scores them with a rule-based engine (or optionally Gemini AI), and delivers deal alerts via **Telegram**.

## Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript** (ESM, strict) | Core language |
| **Gemini 2.5 Flash** | AI qualitative analysis (optional, opt-in) |
| **Grammy** | Telegram bot framework |
| **Playwright** | Headless Chromium for Vinted session/cookies |
| **better-sqlite3** | Embedded SQLite database (WAL mode) |
| **node-cron** | Scheduled jobs (heartbeat, cleanup) |
| **Pino** | JSON logger |
| **Vitest** | Unit testing framework |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Scheduler (every ~30s + jitter)                     │
└────────────┬─────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────┐
│  1. SCRAPER AGENT                                    │
│     • Vinted API (/api/v2/catalog/items)             │
│     • OLX public API (/api/v1/offers)                │
│     → RawItem[]                                      │
└────────────┬─────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────┐
│  2. FILTERING                                        │
│     ✂ Min price (default 20 PLN, dynamic)            │
│     ✂ Kids items, beanies/hats                       │
│     ✂ Poor condition                                 │
│     ✂ Pickup-only items                              │
└────────────┬─────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────┐
│  3. PRICING AGENT                                    │
│     • 14-day rolling window                          │
│     • Size-aware median/P25 with IQR outlier removal │
│     • Confidence score (saturates at 50 samples)     │
│     → PriceSignal (isUnderpriced, discount %)        │
└────────────┬─────────────────────────────────────────┘
             ▼
        [Underpriced items]
             ▼
     ┌───────┴───────┐
     │ ai_enabled?   │
     ├─── false ─────┼─── true ───────────────────┐
     ▼               ▼                             │
┌─────────────┐  ┌──────────────────────────────┐  │
│ RULE-BASED  │  │ AI ANALYST (Gemini 2.5 Flash)│  │
│ • Brand     │  │ • Polish resale expert       │  │
│   tiers     │  │ • Structured output          │  │
│ • Condition │  │ • Persistent AI queue (DB)   │  │
│   mapping   │  │ → AiAnalysis                 │  │
│ • Size      │  └──────────────┬───────────────┘  │
│   popularity│                 ▼                   │
│ • Seller    │  ┌──────────────────────────────┐  │
│   trust     │  │ DECISION (AI weights)        │  │
│ • Shipping  │  │ 40% price + 30% resale       │  │
│ → synthetic │  │ + 20% condition + 10% brand  │  │
│   AiAnalysis│  └──────────────┬───────────────┘  │
└──────┬──────┘                 │                   │
       └────────────┬───────────┘                   │
                    ▼                               │
┌──────────────────────────────────────────────────┐│
│  ⚡ INSTANT ALERTS (always active)                ││
│  • Items >60% below median, >50 PLN, sample >15 ││
│  • Immediate Telegram alert — skip scoring queue ││
└───────────────┬──────────────────────────────────┘│
             ▼
┌──────────────────────────────────────────────────────┐
│  TELEGRAM AGENT                                      │
│     • Photo + caption in single message              │
│     • Inline buttons: link, ❤️ Dodaj/Usuń favorites  │
│     • Remote management: 13 commands                 │
│     • Favorites tracking with sold-speed stats       │
└──────────────────────────────────────────────────────┘
```

## Scanning Strategy

The bot alternates between two scan modes every cycle:

| Cycle | Mode | Vinted | OLX |
|---|---|---|---|
| Odd (1, 3, 5…) | **Priority** | ~73 hype model queries (Jordan 1/4, Dunk, Samba, NB 550…) | ~73 priority queries |
| Even (0, 2, 4…) | **Full** | ~167 queries (all brands + models) | ~167 all queries |

**Category filtering:** Electronics, phones, tablets, laptops, watches, gaming, LEGO, and other specific configs use Vinted `catalog_ids` to filter at API level — prevents cases/screen protectors from polluting results.

OLX searches across all categories (fashion, electronics, collectibles, etc.) — no category filter applied.

Custom queries added via Telegram are merged into the scan list each cycle.

## Pricing Algorithm

1. **Window:** Last 14 days of price history
2. **Size matching:** Tries size-specific group first, falls back to brand+category if < 5 samples
3. **Outlier removal:** IQR method (Q1 − 1.5×IQR … Q3 + 1.5×IQR)
4. **Reference price:** P25 if < 10 samples, otherwise median
5. **Underpriced gate:** Item must be ≥ 65% below reference price (`dealThreshold = 0.35`)
6. **Confidence:** `min(sampleSize / 50, 1.0)`

## Decision Scoring

### Rule-based mode (default, `ai_enabled=0`)

```
score = 0.50 × priceDiscount + 0.20 × brandTier + 0.20 × conditionScore
      + sizeBonus (0–1.0) + sellerBonus (0–0.5)

Brand tiers:  premium (8/10): Nike, Jordan, TNF, Arc'teryx, Supreme, Apple, Sony…
              mid (5/10): Asics, Converse, Columbia, Garmin, Samsung, Carhartt…
              budget (2/10): unknown brands

Condition:    Nowy z metką=9, Nowy bez metki=8, Bardzo dobry=7, Dobry=5, Zadowalający=3

Size bonus:   Most popular (42–45, M/L/XL) +1.0, average (39–40, S/XXL) +0.5
Seller bonus: ≥4.5★ + 20 txn → +0.5,  ≥4.0★ + 10 txn → +0.3

Adjustments:
  if sampleSize < 10      → score × 0.90
  if shipping available    → score + 0.3
  if pickup-only           → score − 0.5
```

### AI mode (opt-in, `ai_enabled=1`)

```
score = 0.4 × priceDiscount + 0.3 × resalePotential
      + 0.2 × conditionConfidence + 0.1 × brandLiquidity

Adjustments:
  if sampleSize < 10      → score × 0.90
  per riskFlag             → score − 0.3
  if inflated_median flag  → score × 0.60
  if shipping available    → score + 0.3
  if pickup-only           → score − 0.5
```

### Shared thresholds

```
score ≥ 9.0 AND profit ≥ 50 PLN → "hot"
score ≥ 6.0 AND profit ≥ 35 PLN → "notify"
else                             → "ignore"
```

AI queue is capped at 100 items, sorted by **discount DESC** (biggest deals first). Daily AI limit: 500 calls (configurable).

All thresholds are adjustable at runtime via Telegram `/set` command.

## Database

SQLite with WAL mode. Tables:

| Table | Purpose |
|---|---|
| `items` | All discovered Vinted/OLX listings |
| `price_history` | Cached market stats (median, P25, sample count) per brand+category+size |
| `decisions` | Scoring results and notification status |
| `heartbeats` | Hourly stats snapshots (cycles, scanned, filtered, notified, errors) |
| `settings` | Dynamic key-value config (synced to in-memory cache) |
| `custom_queries` | User-added search queries via Telegram |
| `ai_queue` | Persistent AI processing queue (priority-sorted, survives restarts) |
| `favorites` | User-starred items with sold-speed tracking |

## Telegram Commands

| Command | Description |
|---|---|
| `/start` | Welcome message with available commands |
| `/status` | Bot status: uptime, current settings, query counts, cycle stats |
| `/pause` | Pause the scanning pipeline |
| `/resume` | Resume the scanning pipeline |
| `/set <key> <value>` | Change a dynamic setting (see table below) |
| `/queries` | Show count of built-in, priority, and custom queries |
| `/queries_add <text>` | Add a custom search query (standard priority) |
| `/queries_add_p <text>` | Add a custom search query (priority — scanned every cycle) |
| `/queries_remove <text>` | Remove a custom query |
| `/queries_list` | List all custom queries with priority/enabled flags |
| `/favorites` | List active favorites with brand, price, score, age |
| `/fav_stats` | Favorites statistics: total, active, sold, avg time to sell |
| `/help` | Show all available commands |

### Notification Inline Buttons

- **🔗 Open link** — Opens the item URL directly
- **❤️ Dodaj do ulubionych / 💔 Usuń z ulubionych** — Toggle favorites (button updates in-place)

### Dynamic Settings (`/set`)

All settings have enforced min/max limits to prevent misconfiguration. Running `/set` without arguments shows all settings with current values, allowed ranges, and risk warnings.

| Key | Default | Range | Description | Warning |
|---|---|---|---|---|
| `notify_threshold` | 6.0 | 3–9.5 | Min score to send a "notify" alert | < 5 = spam, > 8 = almost nothing passes |
| `hot_threshold` | 9.0 | 7–10 | Min score for a "hot" deal alert | < 8 = too easy to be HOT |
| `hot_min_profit` | 50 | 10–500 | Min estimated profit (PLN) for "hot" | < 30 = HOT triggers too cheap |
| `min_price` | 20 | 5–200 | Filter items below this price (PLN) | < 10 = junk, > 50 = miss cheap deals |
| `ai_limit` | 20 | 5–50 | Max AI analyses per cycle | > 30 = Gemini cost grows fast |
| `daily_ai_limit` | 500 | 100–5000 | Max Gemini API calls per day | > 1000 = expensive day |
| `instant_threshold` | 60 | 40–90 | Min discount % for instant alert (no AI) | < 50 = too many instant alerts |
| `min_profit` | 35 | 10–200 | Min est. profit (PLN) to notify | < 20 = spam, > 100 = miss deals |
| `ai_enabled` | 0 | 0–1 | Enable Gemini AI scoring (0=rules, 1=AI) | 1 = requires GEMINI_API_KEY |

## Project Structure

```
src/
├── main.ts                    # Pipeline orchestrator, scheduler, cron jobs
├── config.ts                  # Environment-based static config
├── settings.ts                # Dynamic in-memory settings (synced to DB)
├── bot-state.ts               # Shared runtime state
├── database.ts                # SQLite schema & prepared statements
├── types.ts                   # Shared type definitions
├── filters.ts                 # Item filter predicates (kids, hats, condition, pickup)
├── heartbeat.ts               # Heartbeat message builder
├── logger.ts                  # Pino logger
├── data/
│   └── scan-configs.ts        # Hardcoded search queries (brands, models, electronics)
├── agents/
│   ├── scraper/               # Vinted scraper (Playwright + API)
│   │   ├── index.ts
│   │   ├── vinted-api.ts
│   │   ├── session-manager.ts
│   │   └── proxy-pool.ts
│   ├── scraper-olx/           # OLX.pl scraper (public API)
│   │   ├── index.ts
│   │   └── olx-api.ts
│   ├── pricing/               # Statistical price analysis
│   │   ├── index.ts
│   │   └── price-history.ts
│   ├── ai-analyst/            # Gemini qualitative analysis
│   │   ├── index.ts
│   │   ├── gemini-client.ts
│   │   └── prompts.ts
│   ├── decision/              # Scoring & level determination
│   │   ├── index.ts
│   │   ├── scoring.ts         # AI-based scoring function (pure, testable)
│   │   └── rule-scoring.ts    # Rule-based scoring (brand tiers, condition, size)
│   └── telegram/              # Notifications & remote commands
│       ├── index.ts
│       ├── formatters.ts
│       └── callbacks.ts
tests/
├── helpers.ts                   # Mock factories (mockItem, mockSignal, mockAi)
├── filters.test.ts              # 28 tests: kids, hats, condition, pickup, integration
├── decision.test.ts             # 12 tests: AI scoring, penalties, shipping, levels
└── rule-scoring.test.ts         # 40 tests: brand tiers, condition, size, seller, full scoring
```

## Setup

```bash
npm install
npx playwright install chromium
```

Create `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
# Optional — only needed when ai_enabled=1
GEMINI_API_KEY=your_gemini_key
```

## Run

```bash
npx tsx src/main.ts
```

## Test

```bash
npm test            # run all tests once
npm run test:watch  # watch mode
```

80 unit tests covering filters, decision scoring, rule-based scoring, and level determination.

## AI Development Guidelines

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for mandatory rules on:
- TypeScript/ESM conventions, import patterns
- Agent architecture and pure function patterns
- Testing requirements (every change needs tests)
- Anti-patterns to avoid
- Database access, settings, error handling
- Scan config categories

## Lifecycle

1. **Startup** — Load settings from DB, start Telegram bot, run first pipeline immediately
2. **Every ~30s** — Pipeline cycle (scrape → filter → price → AI → decide → notify)
3. **Every hour** — Heartbeat message with 1-hour stats summary
4. **Every 30 min** — Check favorites sold status (Vinted API)
5. **Every day at 3 AM** — Cleanup old items/decisions (> 30 days)
6. **Graceful shutdown** — SIGINT/SIGTERM sends goodbye message, closes bot, exits

## Cost Controls

- **Daily AI limit** — Hard cap on Gemini API calls per day (default 500)
- **Per-cycle AI limit** — Max items analyzed per cycle (default 20)
- **Queue cap** — Max 100 items in AI queue
- **No photos to Gemini** — Text-only analysis to minimize token cost
- **Priority queue** — Biggest discounts analyzed first (best deals get AI time)
