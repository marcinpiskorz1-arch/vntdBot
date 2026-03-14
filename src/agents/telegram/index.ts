import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
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
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Commands
    this.bot.command("start", (ctx) =>
      ctx.reply(
        "🤖 VintedBot aktywny!\n\n" +
          "Monitoruję Vinted i wyślę Ci powiadomienie gdy znajdę okazję.\n\n" +
          "Komendy:\n" +
          "/stats — statystyki\n" +
          "/help — pomoc"
      )
    );

    this.bot.command("stats", async (ctx) => {
      // TODO: pull real stats from DB
      await ctx.reply("📊 Statystyki — wkrótce dostępne.");
    });

    this.bot.command("help", (ctx) =>
      ctx.reply(
        "🛒 KUP — otwiera link do Vinted\n" +
          "❌ Pomiń — odrzuca ofertę\n" +
          "🧠 Dlaczego? — pokazuje breakdown scoringu\n" +
          "⏰ Snooze — przypomnij za 1h/6h/24h"
      )
    );

    // Inline button callbacks
    this.bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      const [action, vintedId] = data.split(":");

      if (!vintedId) {
        await ctx.answerCallbackQuery("❌ Brak ID");
        return;
      }

      switch (action) {
        case "buy": {
          const decision = getPendingDecision(vintedId);
          const url = decision?.item.url || `${config.vintedDomain}/items/${vintedId}`;
          recordUserAction(vintedId, "buy");
          await ctx.answerCallbackQuery("🛒 Otwórz link poniżej!");
          await ctx.reply(`🛒 <b>Kup teraz:</b>\n<a href="${url}">${url}</a>`, {
            parse_mode: "HTML",
          });
          break;
        }

        case "skip":
          recordUserAction(vintedId, "skip");
          await ctx.answerCallbackQuery("❌ Pominięto");
          break;

        case "why": {
          const decision = getPendingDecision(vintedId);
          if (decision) {
            const payload = formatNotification(decision);
            await ctx.answerCallbackQuery({ text: payload.scoreBreakdown, show_alert: true });
          } else {
            await ctx.answerCallbackQuery("Brak danych");
          }
          break;
        }

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

    // Build inline keyboard
    const keyboard = new InlineKeyboard()
      .text("🛒 KUP", `buy:${payload.itemId}`)
      .text("❌ Pomiń", `skip:${payload.itemId}`)
      .row()
      .text("🧠 Dlaczego?", `why:${payload.itemId}`)
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

// ============================================================
// Standalone test: npx tsx src/agents/telegram/index.ts
// ============================================================
if (process.argv[1]?.includes("telegram")) {
  const agent = new TelegramAgent();
  agent.sendMessage("🤖 VintedBot test — Telegram agent działa!").then(() => {
    console.log("✅ Test message sent to Telegram");
    process.exit(0);
  });
}
