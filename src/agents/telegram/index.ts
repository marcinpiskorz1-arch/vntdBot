import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { botState } from "../../bot-state.js";
import { stmts } from "../../database.js";
import type { Decision } from "../../types.js";
import { formatNotification, buildMessageText } from "./formatters.js";
import {
  storePendingDecision,
  getPendingDecision,
  recordUserAction,
  scheduleSnooze,
} from "./callbacks.js";

const SNOOZE_DURATIONS: Record<string, number> = {
  snooze_1h: 60 * 60 * 1000,
  snooze_6h: 6 * 60 * 60 * 1000,
  snooze_24h: 24 * 60 * 60 * 1000,
};

export class TelegramAgent {
  private bot: Bot;
  private chatId: string;

  constructor() {
    this.bot = new Bot(config.telegramBotToken);
    this.chatId = config.telegramChatId;
    this.bot.catch((err) => {
      logger.error({ err: err.error, update: err.ctx?.update?.update_id }, "Grammy error caught");
    });
    this.setupHandlers();
  }

  private isAuthorized(ctx: Context): boolean {
    return String(ctx.chat?.id) === this.chatId;
  }

  private setupHandlers(): void {
    // ============================================================
    // Management commands
    // ============================================================
    this.bot.command("start", (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      ctx.reply(
        "🤖 VintedBot aktywny!\n\n" +
          "Monitoruję Vinted i wyślę Ci powiadomienie gdy znajdę okazję.\n\n" +
          "Komendy:\n" +
          "/status — status bota + ustawienia\n" +
          "/pause — wstrzymaj skanowanie\n" +
          "/resume — wznów skanowanie\n" +
          "/set <klucz> <wartość> — zmień ustawienie\n" +
          "/queries — info o zapytaniach\n" +
          "/queries_add <tekst> — dodaj zapytanie\n" +
          "/queries_add_p <tekst> — dodaj priorytetowe\n" +
          "/queries_remove <tekst> — usuń zapytanie\n" +
          "/queries_list — lista własnych zapytań\n" +
          "/help — pomoc"
      );
    });

    this.bot.command("pause", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      settings.paused = true;
      await ctx.reply("⏸️ Bot wstrzymany. Użyj /resume żeby wznowić.");
    });

    this.bot.command("resume", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      settings.paused = false;
      await ctx.reply("▶️ Bot wznowiony! Skanowanie aktywne.");
    });

    this.bot.command("status", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const uptime = Math.round((Date.now() - botState.startedAt) / 60000);
      const hours = Math.floor(uptime / 60);
      const mins = uptime % 60;
      const s = settings.dump();

      const lines = [
        "📊 <b>Status VintedBot</b>",
        "",
        `${settings.paused ? "⏸️ WSTRZYMANY" : "▶️ Aktywny"}`,
        `⏱️ Uptime: ${hours}h ${mins}m`,
        `🔄 Cykl: #${botState.cycleCount} ${botState.isRunning ? "(w trakcie)" : ""}`,
        "",
        "<b>Ustawienia:</b>",
        `  📊 Próg powiadomień: ${s.notify_threshold}`,
        `  🔥 Próg HOT: ${s.hot_threshold}`,
        `  💰 Min zysk HOT: ${s.hot_min_profit} PLN`,
        `  💵 Min cena: ${s.min_price} PLN`,
        `  🧠 Limit AI/cykl: ${s.ai_limit}`,
        "",
        "<b>Zapytania:</b>",
        `  📋 Wbudowane: ${botState.totalQueries}`,
        `  ⚡ Priorytetowe: ${botState.priorityQueries}`,
        `  ➕ Własne: ${botState.customQueries}`,
        "",
        "<b>Od ostatniego heartbeat:</b>",
        `  🔍 Sprawdzono: ${botState.stats.scanned}`,
        `  🚫 Odfiltrowano: ${botState.stats.filtered}`,
        `  💰 Zaniżona cena: ${botState.stats.underpriced}`,
        `  🧠 AI: ${botState.stats.aiAnalyzed}`,
        `  📩 Powiadomień: ${botState.stats.notified}`,
        `  ❌ Błędów: ${botState.stats.errors}`,
        `  📋 Kolejka AI: ${botState.aiQueueLength}`,
      ];
      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    });

    this.bot.command("set", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
      if (args.length < 2) {
        const validKeys = settings.VALID_KEYS.join(", ");
        await ctx.reply(`Użycie: /set <klucz> <wartość>\n\nDostępne klucze: ${validKeys}`);
        return;
      }
      const [key, value] = args;
      if (!settings.VALID_KEYS.includes(key as any)) {
        await ctx.reply(`❌ Nieznany klucz: ${key}\n\nDostępne: ${settings.VALID_KEYS.join(", ")}`);
        return;
      }
      const num = parseFloat(value);
      if (isNaN(num)) {
        await ctx.reply(`❌ Wartość musi być liczbą: ${value}`);
        return;
      }
      settings.set(key, value);
      await ctx.reply(`✅ ${key} = ${value}`);
      logger.info({ key, value }, "Setting changed via Telegram");
    });

    this.bot.command("queries", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      await ctx.reply(
        "📋 Zapytania:\n" +
          `  Wbudowane: ${botState.totalQueries}\n` +
          `  Priorytetowe: ${botState.priorityQueries}\n` +
          `  Własne: ${botState.customQueries}\n\n` +
          "Komendy:\n" +
          "/queries_add <tekst> — dodaj\n" +
          "/queries_add_p <tekst> — dodaj priorytetowe\n" +
          "/queries_remove <tekst> — usuń\n" +
          "/queries_list — lista własnych"
      );
    });

    this.bot.command("queries_add", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const text = ctx.message?.text?.replace(/^\/queries_add\s+/, "").trim();
      if (!text) {
        await ctx.reply("Użycie: /queries_add <tekst wyszukiwania>");
        return;
      }
      stmts.addCustomQuery.run({ search_text: text, priority: 0 });
      await ctx.reply(`✅ Dodano zapytanie: "${text}"`);
      logger.info({ query: text, priority: false }, "Custom query added via Telegram");
    });

    this.bot.command("queries_add_p", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const text = ctx.message?.text?.replace(/^\/queries_add_p\s+/, "").trim();
      if (!text) {
        await ctx.reply("Użycie: /queries_add_p <tekst wyszukiwania>");
        return;
      }
      stmts.addCustomQuery.run({ search_text: text, priority: 1 });
      await ctx.reply(`✅ Dodano priorytetowe zapytanie: "${text}" ⚡`);
      logger.info({ query: text, priority: true }, "Priority custom query added via Telegram");
    });

    this.bot.command("queries_remove", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const text = ctx.message?.text?.replace(/^\/queries_remove\s+/, "").trim();
      if (!text) {
        await ctx.reply("Użycie: /queries_remove <tekst wyszukiwania>");
        return;
      }
      const result = stmts.removeCustomQuery.run({ search_text: text });
      if (result.changes > 0) {
        await ctx.reply(`✅ Usunięto zapytanie: "${text}"`);
        logger.info({ query: text }, "Custom query removed via Telegram");
      } else {
        await ctx.reply(`❌ Nie znaleziono zapytania: "${text}"`);
      }
    });

    this.bot.command("queries_list", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const rows = stmts.listCustomQueries.all() as { search_text: string; priority: number; enabled: number }[];
      if (rows.length === 0) {
        await ctx.reply("📋 Brak własnych zapytań. Dodaj: /queries_add <tekst>");
        return;
      }
      const lines = rows.map((r, i) => {
        const flags = [r.priority ? "⚡" : "", !r.enabled ? "🔇" : ""].filter(Boolean).join(" ");
        return `${i + 1}. ${r.search_text} ${flags}`;
      });
      await ctx.reply(`📋 Własne zapytania (${rows.length}):\n\n${lines.join("\n")}`);
    });

    this.bot.command("help", (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      ctx.reply(
        "🤖 <b>VintedBot — komendy</b>\n\n" +
          "<b>Sterowanie:</b>\n" +
          "/pause — wstrzymaj skanowanie\n" +
          "/resume — wznów skanowanie\n" +
          "/status — status + ustawienia\n\n" +
          "<b>Ustawienia:</b>\n" +
          "/set notify_threshold 6.0 — próg powiadomień\n" +
          "/set hot_threshold 9.0 — próg HOT\n" +
          "/set hot_min_profit 50 — min zysk HOT (PLN)\n" +
          "/set min_price 20 — min cena oferty (PLN)\n" +
          "/set ai_limit 200 — limit AI analiz/cykl\n\n" +
          "<b>Zapytania:</b>\n" +
          "/queries — podsumowanie\n" +
          "/queries_add <tekst> — dodaj\n" +
          "/queries_add_p <tekst> — dodaj priorytetowe\n" +
          "/queries_remove <tekst> — usuń\n" +
          "/queries_list — lista własnych\n\n" +
          "<b>Powiadomienia:</b>\n" +
          "🔗 Otwórz na Vinted — link do oferty\n" +
          "⏰ Snooze 1h/6h/24h — przypomnij później",
        { parse_mode: "HTML" }
      );
    });

    // ============================================================
    // Inline button callbacks
    // ============================================================
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      const [action, vintedId] = data.split(":");

      if (!vintedId) {
        await ctx.answerCallbackQuery("❌ Brak ID");
        return;
      }

      switch (action) {
        case "snooze_1h":
        case "snooze_6h":
        case "snooze_24h": {
          const delayMs = SNOOZE_DURATIONS[action];
          if (delayMs) {
            recordUserAction(vintedId, action);
            scheduleSnooze(vintedId, delayMs, (id) => {
              const d = getPendingDecision(id);
              if (d) this.notify(d);
            });
            await ctx.answerCallbackQuery(`⏰ Przypomnę za ${action.replace("snooze_", "")}`);
          }
          break;
        }

        default:
          await ctx.answerCallbackQuery("❓ Nieznana akcja");
      }
    });
  }

  /** Send a deal notification to the configured chat */
  async notify(decision: Decision): Promise<void> {
    const payload = formatNotification(decision);
    const text = buildMessageText(payload);

    // Store for callback handlers
    storePendingDecision(decision);

    // Build inline keyboard — just snooze reminders + link
    const keyboard = new InlineKeyboard()
      .url("🔗 Otwórz na Vinted", payload.vintedUrl)
      .row()
      .text("⏰ 1h", `snooze_1h:${payload.itemId}`)
      .text("⏰ 6h", `snooze_6h:${payload.itemId}`)
      .text("⏰ 24h", `snooze_24h:${payload.itemId}`);

    try {
      // Try sending with photo
      if (payload.photoUrl) {
        await this.bot.api.sendPhoto(this.chatId, payload.photoUrl, {
          caption: text,
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } else {
        await this.bot.api.sendMessage(this.chatId, text, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      }

      logger.info(
        { item: payload.itemId, level: decision.level },
        "Telegram notification sent"
      );
    } catch (err) {
      logger.error({ err, item: payload.itemId }, "Failed to send Telegram notification");

      // Fallback: send without photo
      if (payload.photoUrl) {
        try {
          await this.bot.api.sendMessage(this.chatId, text, {
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
        } catch (fallbackErr) {
          logger.error({ err: fallbackErr }, "Fallback message also failed");
        }
      }
    }
  }

  /** Send a simple text message (for heartbeats, errors, etc.) */
  async sendMessage(text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(this.chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error({ err }, "Failed to send Telegram message");
    }
  }

  /** Start the bot (long polling for incoming messages/callbacks) */
  async start(): Promise<void> {
    logger.info("Starting Telegram bot...");
    this.bot.start({
      onStart: () => logger.info("Telegram bot is running"),
    });
  }

  /** Stop the bot gracefully */
  async stop(): Promise<void> {
    await this.bot.stop();
  }
}
