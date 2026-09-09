import type { SceneDataStore } from './sceneDataStore';
import { CINEMA_BASE_PATH } from './cinemaApi';

export interface FeedPollStatus { feed: string; enabled: boolean; ok: boolean; at?: string; error?: string; issues: string[]; counts: Record<string, { rows: number; kept: number }>; nextAt?: string }
export interface FeedPollSummary { mode: 'server' | 'static' | 'error'; feeds: FeedPollStatus[]; applied: number; rejected: string[]; error?: string; at: string }
export interface FeedPollingOptions {
  fetch: typeof globalThis.fetch | undefined;
  basePath: string;
  onStatus?: (summary: FeedPollSummary) => void;
  /** Test hook; defaults to setTimeout. */
  schedule?: (callback: () => void, ms: number) => () => void;
  minIntervalSeconds?: number;
}
export const FEED_POLL_PATH = '/api/cinema/feed';

const defaultSchedule = (callback: () => void, ms: number) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); };

/**
 * Server feed adapter (contract §4): polls the feed route and replaces scene data with whatever
 * the enabled feeds produced. A static deployment has no route; the first 404 or non-JSON reply
 * ends polling quietly and the demo/static data stays.
 */
export function startFeedPolling(store: SceneDataStore, options: FeedPollingOptions) {
  const schedule = options.schedule ?? defaultSchedule;
  const minInterval = Math.max(1, options.minIntervalSeconds ?? 5);
  let stopped = false;
  let cancel: (() => void) | undefined;
  const report = (summary: FeedPollSummary) => options.onStatus?.(summary);
  const next = (seconds: number) => { if (!stopped) cancel = schedule(() => { void tick(); }, Math.max(minInterval, seconds) * 1000); };
  async function tick() {
    if (stopped || !options.fetch) return;
    const at = new Date().toISOString();
    let body: { documents?: unknown[]; feeds?: FeedPollStatus[]; nextInSeconds?: number; error?: string };
    try {
      const response = await options.fetch(`${options.basePath}${FEED_POLL_PATH}`, { cache: 'no-store' });
      if (response.status === 404 || !(response.headers.get('content-type') ?? '').includes('application/json')) {
        report({ mode: 'static', feeds: [], applied: 0, rejected: [], at }); return;
      }
      if (!response.ok) { report({ mode: 'error', feeds: [], applied: 0, rejected: [], error: `피드 응답 ${response.status}`, at }); next(30); return; }
      body = await response.json();
    } catch (error) {
      report({ mode: 'error', feeds: [], applied: 0, rejected: [], error: error instanceof Error ? error.message : '피드를 읽지 못했습니다.', at }); next(30); return;
    }
    const rejected: string[] = [];
    let applied = 0;
    for (const document of body.documents ?? []) {
      const result = store.replace(document);
      if (result.ok) applied++; else rejected.push(result.reason);
    }
    report({ mode: 'server', feeds: body.feeds ?? [], applied, rejected, error: body.error, at });
    next(Number.isFinite(body.nextInSeconds) ? Number(body.nextInSeconds) : 30);
  }
  void tick();
  return () => { stopped = true; cancel?.(); };
}

export function browserFeedPollingOptions(): Pick<FeedPollingOptions, 'fetch' | 'basePath'> {
  return { fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : undefined, basePath: CINEMA_BASE_PATH };
}
