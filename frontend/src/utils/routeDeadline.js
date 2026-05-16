/** Rota hesabı üst süre (ms) — UI donmasın. */
export const ROUTE_TOTAL_BUDGET_MS = 28000;
export const GEMINI_ROUTE_BUDGET_MS = 10000;

export function createRouteDeadline(ms = ROUTE_TOTAL_BUDGET_MS) {
  const t0 = Date.now();
  return {
    expired: () => Date.now() - t0 >= ms,
    remainingMs: () => Math.max(0, ms - (Date.now() - t0)),
  };
}

export function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}
