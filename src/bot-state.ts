/**
 * Shared runtime state — updated by main.ts, read by telegram commands.
 * NOT persisted to DB (in-memory only).
 */
export const botState = {
  cycleCount: 0,
  isRunning: false,
  aiQueueLength: 0,

  totalQueries: 0,
  priorityQueries: 0,
  customQueries: 0,

  startedAt: Date.now(),

  // Cumulative stats (reset every heartbeat)
  stats: {
    cycles: 0,
    scanned: 0,
    filtered: 0,
    underpriced: 0,
    aiAnalyzed: 0,
    notified: 0,
    errors: 0,
  },
};
