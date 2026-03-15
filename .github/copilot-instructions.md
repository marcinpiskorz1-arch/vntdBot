# VintedBot — AI Development Instructions

These rules are **mandatory** for all AI-assisted development on this project.
Violations will cause real bugs in production — the bot runs 24/7 and processes money decisions.

---

## 1. Language & Module System

- **TypeScript strict mode** — no `any`, no `@ts-ignore`, no `as` casts unless truly necessary
- **Pure ESM** — `"type": "module"` in package.json
- **All imports must use `.js` extension**: `import { foo } from "./bar.js"` (not `./bar` or `./bar.ts`)
- **Use `import type { ... }`** for type-only imports — never import types as values
- **Named exports only** — no `export default`. Every module exports named symbols
- **Target**: ES2022, module resolution: bundler

## 2. Architecture Rules

### Agent Pattern
Each agent lives in `src/agents/<name>/index.ts` as a **class with methods**:
```ts
export class FooAgent {
  methodName(input: InputType): OutputType { ... }
}
```
- Instantiated **once** in `main.ts`, never re-created
- Agents do NOT import other agents — `main.ts` orchestrates the pipeline
- Agent classes should be thin wrappers; extract logic into pure helper functions

### Pure Functions
Business logic MUST be extracted into **pure, testable functions**:
```ts
// Good: pure function with injected config
export function computeScore(item: RawItem, signal: PriceSignal, cfg: ScoreConfig): ScoreResult

// Bad: function that reads settings/DB internally
export function computeScore(item: RawItem, signal: PriceSignal): ScoreResult {
  const threshold = settings.notifyThreshold; // WRONG — hidden dependency
}
```
- Config/settings are **always injected as parameters** to pure functions
- Pure functions go in separate files (e.g., `scoring.ts`, `rule-scoring.ts`, `formatters.ts`)
- Agent `index.ts` calls pure functions and handles side effects (DB, API, logging)

### Database Access
- All SQL uses **prepared statements** in `src/database.ts` exported as `stmts`
- Named parameters: `@vinted_id`, `@brand` (not positional `?`)
- Never write raw SQL outside `database.ts` — add a new prepared statement instead
- Migrations: `try { db.exec("ALTER TABLE ...") } catch { /* already exists */ }`

### Settings / Config
- **Static config** (`src/config.ts`): env vars, read once, immutable
- **Dynamic settings** (`src/settings.ts`): DB-backed, changeable via Telegram `/set`
- New dynamic settings need: getter in `settings`, entry in `dump()`, entry in `VALID_KEYS`, entry in `RULES`

## 3. Testing — MANDATORY

### Every change MUST include tests
- **New pure function** → add tests in `tests/<module>.test.ts`
- **New filter** → add tests in `tests/filters.test.ts`
- **New scoring logic** → add tests in `tests/rule-scoring.test.ts` or `tests/decision.test.ts`
- **Bug fix** → add a regression test that reproduces the bug first

### Test conventions
- Framework: **Vitest** — `import { describe, it, expect } from "vitest"`
- Tests live in `tests/` directory (not colocated with source)
- Use mock factories from `tests/helpers.ts`:
  ```ts
  mockItem({ price: 19, brand: "Nike" })
  mockSignal({ sampleSize: 5, medianPrice: 200 })
  mockAi({ resalePotential: 8 })
  ```
- **No mocking framework** — no `vi.mock()`, no `vi.spyOn()`. Test pure functions only.
- If you need to test something that requires mocking, refactor it into a pure function first
- Run `npx vitest run` before every commit — all tests must pass

### What NOT to test
- Don't test framework internals (Grammy, Playwright, better-sqlite3)
- Don't test `main.ts` orchestration directly — test the pure functions it calls
- Don't add tests for trivial getters/setters

## 4. Anti-Patterns — DO NOT

| Anti-pattern | Why | Do instead |
|---|---|---|
| `export default` | Breaks refactoring, unclear imports | Named exports only |
| Import without `.js` | ESM resolution fails at runtime | Always `"./file.js"` |
| `any` type | Defeats TypeScript's purpose | Proper types or `unknown` |
| Side effects in pure functions | Untestable, hidden dependencies | Inject deps as params |
| Raw SQL outside `database.ts` | Can't track/maintain queries | Add to `stmts` |
| `console.log` | Lost in production, no structure | Use `logger` (Pino) |
| Standalone test blocks in source | Dead code in production builds | Use `tests/` directory |
| `setTimeout`/`setInterval` patterns | Unreliable, hard to test | Use `node-cron` or pipeline cycle |
| Reverse string containment (`p.includes(shortStr)`) | "on" matches "salomon" | Only `input.includes(pattern)` |
| Regex without Polish chars | `\b` doesn't match ą/ę/ó/ś/ź/ż/ł/ń | Use `(?:^\|[\\s,;(])` instead of `\b` |
| Hardcoded magic numbers | Unexplainable behavior | Use `config.ts` or `settings.ts` |
| Nested try/catch without re-throw | Swallows errors silently | Log error, then re-throw or return fallback |

## 5. Code Style

- **Polish** in user-facing strings (Telegram messages, logs meant for user)
- **English** in code: variable names, function names, comments, types
- Section separators: `// ============` banners for visual grouping in large files
- No comments for obvious code — only explain **why**, not **what**
- Interfaces over type aliases for object shapes (defined in `src/types.ts`)
- Keep agent files under ~200 lines — extract helpers when growing

## 6. Telegram Messages

- All user-facing text must be **HTML-escaped** via `escapeHtml()` from `formatters.ts`
- Use `parse_mode: "HTML"` (not Markdown) — it's the project standard
- Photo notifications: single message with `caption` (not photo + separate text)
- Inline buttons: `InlineKeyboard` from Grammy
- New `/set` keys need validation rules in `settings.RULES`

## 7. Scan Configs & Categories

- Configs live in `src/data/scan-configs.ts` as `ScanConfig[]`
- **Electronics/watches/gaming/LEGO** configs MUST have `categoryIds` to filter accessories at API level
- **Clothing/outdoor brands** should NOT have `categoryIds` (most items lack catalog_id on Vinted)
- New brand additions: check if it needs `categoryIds` by querying the DB for category distribution

## 8. Error Handling

- API calls: `try/catch`, log error, increment `botState.stats.errors`, continue pipeline
- DB operations: prepared statements handle most errors; migrations use `try/catch` pattern
- Telegram: fallback to text-only if photo fails, never crash the bot
- AI: return conservative fallback `AiAnalysis` on failure, never block the pipeline
- **Never** let a single item error crash the entire scan cycle

## 9. Performance Rules

- Don't `await` inside loops when calls are independent — use `Promise.all` or batch
- DB reads in hot paths should use prepared statements (already compiled)
- Don't fetch full item data when `SELECT 1` suffices (use `itemExists` pattern)
- Price history: IQR outlier removal is already implemented — don't add another layer

## 10. Git Workflow

- Commit messages: `feat:`, `fix:`, `refactor:`, `docs:` prefixes
- Run `npx vitest run` before every commit
- Don't commit `data/` directory (SQLite), `node_modules/`, or `dist/`
- Scripts in `scripts/` are throwaway analysis tools — don't import them from `src/`

## 11. Project File Map

```
src/main.ts              — Pipeline orchestrator (DO NOT put business logic here)
src/config.ts            — Static env config (immutable after startup)
src/settings.ts          — Dynamic DB-backed settings (changeable at runtime)
src/database.ts          — Schema, migrations, all prepared statements
src/types.ts             — Shared interfaces (RawItem, PriceSignal, AiAnalysis, Decision, etc.)
src/filters.ts           — Pure filter predicates (kids, hats, condition, pickup)
src/heartbeat.ts         — Heartbeat message builder (pure function)
src/data/scan-configs.ts — Hardcoded search queries with optional categoryIds
src/agents/              — One directory per agent, index.ts + helpers
tests/                   — Vitest tests, one file per module
tests/helpers.ts         — Mock factories (mockItem, mockSignal, mockAi)
```
