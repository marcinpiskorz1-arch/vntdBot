import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { botState } from "../../bot-state.js";
import { stmts } from "../../database.js";
import type { Decision } from "../../types.js";
import { formatNotification, buildMessageText, escapeHtml } from "./formatters.js";
import {
  storePendingDecision,
  getPendingDecision,
  recordUserAction,
} from "./callbacks.js";

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
        "🤖 <b>VintedBot aktywny!</b>\n\n" +
          "Monitoruję Vinted i wyślę Ci powiadomienie gdy znajdę okazję.\n\n" +
          "Wpisz /help żeby zobaczyć wszystkie komendy.",
        { parse_mode: "HTML" }
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
        `🧮 Scoring: ${s.ai_enabled ? "reguły + AI photo verify" : "rule-based"}`,
        `⏱️ Uptime: ${hours}h ${mins}m`,
        `🔄 Cykl: #${botState.cycleCount} ${botState.isRunning ? "(w trakcie)" : ""}`,
        "",
        "<b>Ustawienia:</b>  (/set)",
        `  ai_enabled: ${s.ai_enabled ? "1 (reguły + AI photo verify)" : "0 (rule-based)"}`,
        `  notify_threshold: ${s.notify_threshold} — min score do powiadomienia`,
        `  hot_threshold: ${s.hot_threshold} — min score dla 🔥 HOT`,
        `  hot_min_profit: ${s.hot_min_profit} PLN — min zysk dla HOT`,
        `  min_price: ${s.min_price} PLN — pomijaj tańsze oferty`,
        `  instant_threshold: ${s.instant_threshold}% — instant alert od tej zniżki`,
        `  min_profit: ${s.min_profit} PLN — min zysk żeby powiadomić`,
        `  deal_threshold: ${s.deal_threshold} — próg cenowy (${Math.round((1 - (s.deal_threshold as number)) * 100)}% zniżki)`,
        ...(s.ai_enabled ? [
          `  daily_ai_limit: ${s.daily_ai_limit} — twardy limit AI / dzień`,
          "",
          `<b>AI photo verify:</b> ${botState.daily.aiCalls}/${s.daily_ai_limit} (${Math.round((botState.daily.aiCalls / (s.daily_ai_limit as number || 1)) * 100)}%)`,
        ] : []),
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
        `  🧮 Ocenionych: ${botState.stats.aiAnalyzed}`,
        `  📩 Powiadomień: ${botState.stats.notified}`,
        `  ❌ Błędów: ${botState.stats.errors}`,
      ];
      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    });

    this.bot.command("set", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
      if (args.length < 2) {
        const keys = settings.VALID_KEYS.map(k => {
          const r = settings.RULES[k];
          return `  <b>${k}</b> (${r.min}–${r.max})`;
        });
        await ctx.reply(
          "Użycie: /set &lt;klucz&gt; &lt;wartość&gt;\n\n" +
          "Dostępne klucze:\n" + keys.join("\n") +
          "\n\nAktualne wartości: /status",
          { parse_mode: "HTML" }
        );
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
      const rule = settings.RULES[key];
      if (rule && (num < rule.min || num > rule.max)) {
        await ctx.reply(`❌ ${key} musi być ${rule.min}–${rule.max} (podano: ${num})\n\n⚠️ ${rule.warn}`);
        return;
      }
      settings.set(key, value);
      await ctx.reply(`✅ ${key} = ${value}${rule ? `\n\n💡 ${rule.desc}` : ""}`);
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
      await ctx.reply(`✅ Dodano zapytanie: "${escapeHtml(text)}"`);
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
      await ctx.reply(`✅ Dodano priorytetowe zapytanie: "${escapeHtml(text)}" ⚡`);
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
        await ctx.reply(`✅ Usunięto zapytanie: "${escapeHtml(text)}"`);
        logger.info({ query: text }, "Custom query removed via Telegram");
      } else {
        await ctx.reply(`❌ Nie znaleziono zapytania: "${escapeHtml(text)}"`);
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
          "<b>Ustawienia (/set):</b>\n" +
          "/set — pokaż wszystkie z opisami i limitami\n" +
          "/set &lt;klucz&gt; &lt;wartość&gt; — zmień\n\n" +
          "<b>Zapytania:</b>\n" +
          "/queries — podsumowanie\n" +
          "/queries_add &lt;tekst&gt; — dodaj zwykłe\n" +
          "/queries_add_p &lt;tekst&gt; — dodaj priorytetowe (co cykl)\n" +
          "/queries_remove &lt;tekst&gt; — usuń\n" +
          "/queries_list — lista własnych\n\n" +
          "<b>Ulubione:</b>\n" +
          "/favorites — lista ulubionych\n" +
          "/fav_stats — statystyki sprzedaży\n\n" +
          "<b>Powiadomienia:</b>\n" +
          "🔗 Open link — link do oferty\n" +
          "❤️ Ulubione — dodaj/usuń z ulubionych\n\n" +
          "<b>⚠️ Wskazówki:</b>\n" +
          "• ai_enabled = 1 → AI weryfikuje zdjęcia dla niejasnych tytułów\n" +
          "• notify_threshold &lt; 5 = spam powiadomień (zakres 3–9.5)\n" +
          "• min_price &lt; 10 = tonę śmieciowych ofert (zakres 5–200)\n" +
          "• Wpisz /set żeby zobaczyć wszystkie limity",
        { parse_mode: "HTML" }
      );
    });

    // ============================================================
    // Favorites commands
    // ============================================================
    this.bot.command("favorites", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const favs = stmts.getFavorites.all() as Array<{
        vinted_id: string; title: string; brand: string; price: number; score: number; url: string; photo_url: string; added_at: string;
      }>;
      if (favs.length === 0) {
        await ctx.reply("❤️ Brak ulubionych. Kliknij ❤️ przy powiadomieniu żeby dodać.");
        return;
      }
      await ctx.reply(`❤️ <b>Ulubione (${favs.length})</b>`, { parse_mode: "HTML" });
      for (const f of favs) {
        const ago = Math.round((Date.now() - new Date(f.added_at).getTime()) / 3600000);
        const text = `<b>${escapeHtml(f.title)}</b>\n${escapeHtml(f.brand)} | ${f.price} PLN | ⭐${f.score.toFixed(1)} | ${ago}h temu`;
        const keyboard = new InlineKeyboard()
          .url("🔗 Link", f.url)
          .text("💔 Usuń", `rmfav:${f.vinted_id}`);
        try {
          if (f.photo_url) {
            await this.bot.api.sendPhoto(this.chatId, f.photo_url, {
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
        } catch {
          await this.bot.api.sendMessage(this.chatId, text, {
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
        }
      }
    });

    this.bot.command("fav_stats", async (ctx) => {
      if (!this.isAuthorized(ctx)) return;
      const stats = stmts.getFavoriteStats.get() as {
        total: number; active: number; sold: number; avg_hours_to_sell: number | null;
      };
      if (!stats || stats.total === 0) {
        await ctx.reply("📊 Brak danych — dodaj najpierw ulubione.");
        return;
      }

      const soldPct = stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0;
      const avgHours = stats.avg_hours_to_sell != null ? stats.avg_hours_to_sell.toFixed(1) : "—";

      // Get recently sold
      const allFavs = stmts.getAllFavorites.all() as Array<{
        title: string; price: number; status: string; added_at: string; sold_at: string | null;
      }>;
      const recentSold = allFavs
        .filter(f => f.status === "sold" && f.sold_at)
        .slice(0, 5)
        .map(f => {
          const hours = Math.round((new Date(f.sold_at!).getTime() - new Date(f.added_at).getTime()) / 3600000);
          return `  • ${escapeHtml(f.title)} — ${f.price} PLN — sprzedane po ${hours}h`;
        });

      const lines = [
        `📊 <b>Statystyki ulubionych</b>`,
        ``,
        `❤️ Łącznie: ${stats.total}`,
        `🟢 Aktywne: ${stats.active}`,
        `🔴 Sprzedane: ${stats.sold} (${soldPct}%)`,
        `⏱️ Średni czas do sprzedaży: ${avgHours}h`,
      ];

      if (recentSold.length > 0) {
        lines.push(``, `<b>Ostatnio sprzedane:</b>`);
        lines.push(...recentSold);
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
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
        case "fav": {
          const existing = stmts.getFavoriteByVintedId.get({ vinted_id: vintedId }) as any;
          if (existing) {
            stmts.removeFavorite.run({ vinted_id: vintedId });
            await ctx.answerCallbackQuery("💔 Usunięto z ulubionych");
          } else {
            const decision = getPendingDecision(vintedId);
            if (decision) {
              const photoUrls = decision.item.photoUrls || [];
              stmts.addFavorite.run({
                vinted_id: vintedId,
                title: decision.item.title,
                brand: decision.item.brand,
                price: decision.item.price,
                url: decision.item.url,
                photo_url: photoUrls[0] || "",
                score: decision.score,
              });
            } else {
              // Fallback — get from items table
              const item = stmts.getItemByVintedId.get({ vinted_id: vintedId }) as any;
              if (item) {
                stmts.addFavorite.run({
                  vinted_id: vintedId,
                  title: item.title,
                  brand: item.brand,
                  price: item.price,
                  url: item.url,
                  photo_url: "",
                  score: 0,
                });
              }
            }
            await ctx.answerCallbackQuery("❤️ Dodano do ulubionych!");
          }

          // Update the button label to reflect new state
          try {
            const nowFav = !existing;
            const oldMarkup = ctx.callbackQuery.message?.reply_markup;
            if (oldMarkup) {
              const newRows = oldMarkup.inline_keyboard.map(row =>
                row.map(btn => {
                  if ("callback_data" in btn && btn.callback_data?.startsWith("fav:")) {
                    return { ...btn, text: nowFav ? "💔 Usuń z ulubionych" : "❤️ Dodaj do ulubionych" };
                  }
                  return btn;
                })
              );
              await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: newRows } });
            }
          } catch { /* ignore edit errors for old messages */ }
          break;
        }

        case "rmfav": {
          const fav = stmts.getFavoriteByVintedId.get({ vinted_id: vintedId }) as any;
          if (fav) {
            stmts.removeFavorite.run({ vinted_id: vintedId });
            await ctx.answerCallbackQuery("💔 Usunięto z ulubionych");
            try {
              await ctx.deleteMessage();
            } catch { /* ignore if message too old */ }
          } else {
            await ctx.answerCallbackQuery("❓ Nie znaleziono w ulubionych");
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

    // Build inline keyboard — link + favorite
    const isFav = !!stmts.getFavoriteByVintedId.get({ vinted_id: payload.itemId });
    const keyboard = new InlineKeyboard()
      .url("🔗 Open link", payload.vintedUrl)
      .row()
      .text(isFav ? "💔 Usuń z ulubionych" : "❤️ Dodaj do ulubionych", `fav:${payload.itemId}`);

    try {
      if (payload.photoUrl) {
        // Send photo with caption — single message instead of two
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

  /** Send a simple text message (for heartbeats, errors, etc.) */
  async sendMessage(text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(this.chatId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.error({ err }, "Failed to send Telegram message");
    }
  }

  /** Send an instant alert (no AI) for a mega-deal item */
  async sendInstantAlert(opts: {
    vintedId: string;
    title: string;
    brand: string;
    price: number;
    medianPrice: number;
    discountPct: number;
    sampleSize: number;
    url: string;
    photoUrl?: string;
  }): Promise<void> {
    const discount = Math.round(opts.discountPct);
    const profit = Math.round(opts.medianPrice - opts.price);

    const text = [
      `⚡ <b>INSTANT DEAL</b>`,
      ``,
      `<b>${escapeHtml(opts.title)}</b>`,
      `💰 ${opts.price} PLN (rynek: ${Math.round(opts.medianPrice)} PLN, -${discount}%)`,
      `📈 Szacowany zysk: ~${profit} PLN`,
      `📊 Próbka: ${opts.sampleSize} ofert`,
      `🏷️ ${opts.brand ? escapeHtml(opts.brand) : "—"}`,
      ``,
      `⚠️ <i>Instant alert — zweryfikuj ręcznie!</i>`,
    ].join("\n");

    const isFav = !!stmts.getFavoriteByVintedId.get({ vinted_id: opts.vintedId });
    const keyboard = new InlineKeyboard()
      .url("🔗 Open link", opts.url)
      .row()
      .text(isFav ? "💔 Usuń z ulubionych" : "❤️ Dodaj do ulubionych", `fav:${opts.vintedId}`);

    try {
      if (opts.photoUrl) {
        await this.bot.api.sendPhoto(this.chatId, opts.photoUrl, {
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
      logger.info({ item: opts.vintedId, discount }, "⚡ Instant alert sent");
    } catch (err) {
      logger.error({ err, item: opts.vintedId }, "Failed to send instant alert");
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
