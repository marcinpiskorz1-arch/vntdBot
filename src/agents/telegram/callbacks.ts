import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { Decision } from "../../types.js";

// In-memory store for decisions pending callback (keyed by vintedId)
const pendingDecisions = new Map<string, Decision>();

export function storePendingDecision(decision: Decision): void {
  pendingDecisions.set(decision.item.vintedId, decision);
}

export function getPendingDecision(vintedId: string): Decision | undefined {
  return pendingDecisions.get(vintedId);
}

/** Record user's action (buy/skip/snooze) in the database */
export function recordUserAction(vintedId: string, action: string): void {
  try {
    stmts.updateUserAction.run({ vinted_id: vintedId, user_action: action });
    logger.info({ vintedId, action }, "User action recorded");
  } catch (err) {
    logger.error({ err, vintedId, action }, "Failed to record user action");
  }
}

// Snooze timers — maps vintedId to timeout handle
const snoozeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedule a re-notification after delay.
 * The callback will be called with the vintedId.
 */
export function scheduleSnooze(
  vintedId: string,
  delayMs: number,
  callback: (vintedId: string) => void
): void {
  // Clear existing snooze if any
  const existing = snoozeTimers.get(vintedId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    snoozeTimers.delete(vintedId);
    callback(vintedId);
  }, delayMs);

  snoozeTimers.set(vintedId, timer);
  logger.info({ vintedId, delayMin: delayMs / 60000 }, "Snooze scheduled");
}
