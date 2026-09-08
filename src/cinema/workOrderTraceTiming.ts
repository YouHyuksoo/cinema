/** One-time entrance and production cycle share the same release boundary. */
export const TRACE_TIMING = {
  createdAt: .6, launchAt: 2.4, unitInterval: .06, stageDuration: 1.25,
  summaryAt: 20, fadeAt: 23, endAt: 24,
} as const;

/** Chapter repeats keep the installed line and resume at the first PCB release. */
export const TRACE_LOOP = { start: TRACE_TIMING.launchAt, end: TRACE_TIMING.fadeAt } as const;
