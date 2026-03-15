# VintedBot — AI Deal Sniper

Autonomous deal-hunting bot that continuously monitors **Vinted** and **OLX.pl** for underpriced items, runs them through a multi-stage AI scoring pipeline, and delivers high-confidence deal alerts via **Telegram**.

## Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript** (ESM, strict) | Core language |
| **Gemini 2.5 Flash** | AI qualitative analysis (structured output) |
| **Grammy** | Telegram bot framework |
| **Playwright** | Headless Chromium for Vinted session/cookies |
| **better-sqlite3** | Embedded SQLite database (WAL mode) |
| **node-cron** | Scheduled jobs (heartbeat, cleanup) |
| **Pino** | JSON logger |

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
        [Underpriced items → persistent AI queue (DB)]
             ▼
┌──────────────────────────────────────────────────────┐
│  4. AI ANALYST AGENT (Gemini 2.5 Flash)              │
│     • Polish resale expert persona                   │
│     • Structured output: resalePotential,            │
│       conditionConfidence, brandLiquidity,            │
│       estimatedProfit, riskFlags, reasoning           │
│     → AiAnalysis                                     │
└────────────┬─────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────┐
│  5. DECISION AGENT                                   │
│     • Weighted score:                                │
│       40% price + 30% resale + 20% condition         │
│       + 10% brand liquidity                          │
│     • Bonuses/penalties (shipping, pickup, risks)    │
│     • Level: "hot" / "notify" / "ignore"             │
│     → Decision                                       │
└────────────┬─────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────┐
│  6. TELEGRAM AGENT                                   │
│     • Photo + HTML notification with score breakdown │
│     • Inline buttons: Vinted link, snooze (1h/6h/24h)│
│     • Remote management commands                     │
└──────────────────────────────────────────────────────┘
```

## Scanning Strategy

The bot alternates between two scan modes every cycle:

| Cycle | Mode | Vinted | OLX |
|---|---|---|---|
| Odd (1, 3, 5…) | **Priority** | ~73 hype model queries (Jordan 1/4, Dunk, Samba, NB 550…) | ~73 priority queries |
| Even (0, 2, 4…) | **Full** | ~167 queries (all brands + models) | ~167 all queries |

OLX searches across all categories (fashion, electronics, collectibles, etc.) — no category filter applied.

Custom queries added via Telegram are merged into the scan list each cycle.

## Pricing Algorithm

1. **Window:** Last 14 days of price history
2. **Size matching:** Tries size-specific group first, falls back to brand+category if < 5 samples
3. **Outlier removal:** IQR method (Q1 − 1.5×IQR … Q3 + 1.5×IQR)
4. **Reference price:** P25 if < 10 samples, otherwise median
5. **Underpriced gate:** Item must be ≥ 40% below reference price (`dealThreshold = 0.6`)
6. **Confidence:** `min(sampleSize / 50, 1.0)`

## Decision Scoring

```
score = 0.4 × priceDiscount + 0.3 × resalePotential
      + 0.2 × conditionConfidence + 0.1 × brandLiquidity

Adjustments:
  if sampleSize < 10      → score × 0.90
  per riskFlag             → score − 0.3
  if shipping available    → score + 0.3
  if pickup-only           → score − 0.5

Levels:
  score ≥ 9.0 AND profit ≥ 50 PLN → "hot"
  score ≥ 6.0 AND profit ≥ 35 PLN → "notify"
  else                             → "ignore"
```

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
| `ai_queue` | Persistent AI processing queue (survives restarts) |

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
| `/help` | Show all available commands |

### Notification Inline Buttons

- **Otwórz na Vinted** — Opens the item URL directly
- **1h / 6h / 24h** — Snooze the notification and get a reminder later

### Dynamic Settings (`/set`)

| Key | Default | Description |
|---|---|---|
| `notify_threshold` | 6.0 | Minimum score to send a "notify" alert |
| `hot_threshold` | 9.0 | Minimum score for a "hot" deal alert |
| `hot_min_profit` | 50 | Minimum estimated profit (PLN) for "hot" level |
| `min_price` | 20 | Filter out items below this price (PLN) |
| `ai_limit` | 200 | Max AI analyses per cycle |

## Project Structure

```
src/
├── main.ts                    # Entry point, pipeline orchestrator, scheduler
├── config.ts                  # Environment-based static config
├── settings.ts                # Dynamic in-memory settings (synced to DB)
├── bot-state.ts               # Shared runtime state
├── database.ts                # SQLite schema & prepared statements
├── types.ts                   # Shared type definitions
├── logger.ts                  # Pino logger
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
│   │   └── index.ts
│   └── telegram/              # Notifications & remote commands
│       ├── index.ts
│       ├── formatters.ts
│       └── callbacks.ts
└── purchasing/
    └── buyer.ts               # (stub for future automation)
```

## Setup

```bash
npm install
npx playwright install chromium
```

Create `.env`:

```env
GEMINI_API_KEY=your_gemini_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Run

```bash
npx tsx src/main.ts
```

## Lifecycle

1. **Startup** — Load settings from DB, start Telegram bot, run first pipeline immediately
2. **Every ~30s** — Pipeline cycle (scrape → filter → price → AI → decide → notify)
3. **Every hour** — Heartbeat message with 1-hour stats summary
4. **Every day at 3 AM** — Cleanup old items/decisions (> 30 days)
5. **Graceful shutdown** — SIGINT/SIGTERM sends goodbye message, closes bot, exits
