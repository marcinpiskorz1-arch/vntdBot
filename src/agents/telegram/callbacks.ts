import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { Decision } from "../../types.js";

// In-memory store for decisions pending callback (keyed by vintedId)
const pendingDecisions = new Map<string, Decision>();
const MAX_PENDING = 500;

export function storePendingDecision(decision: Decision): void {
  if (pendingDecisions.size >= MAX_PENDING) {
    // Evict oldest entry (FIFO)
    const oldest = pendingDecisions.keys().next().value!;
    pendingDecisions.delete(oldest);
  }
  pendingDecisions.set(decision.item.vintedId, decision);
}

export function getPendingDecision(vintedId: string): Decision | undefined {
  return pendingDecisions.get(vintedId);
}

/** Record user's action (buy/skip) in the database */
export function recordUserAction(vintedId: string, action: string): void {
  try {
    stmts.updateUserAction.run({ vinted_id: vintedId, user_action: action });
    logger.info({ vintedId, action }, "User action recorded");
  } catch (err) {
    logger.error({ err, vintedId, action }, "Failed to record user action");
  }
}
