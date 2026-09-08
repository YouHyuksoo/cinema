import { domainFeed } from '@/cinema/domainFeeds';
import type { FeedMappingConfig, HatcheryConfig } from '@/cinema/feedConfig';
import { mapRowsToFeedData, type FeedRow } from '@/cinema/feedMapping';
import { feedToSceneDocuments } from '@/cinema/feedScenes';
import type { SceneDataDocument } from '@/cinema/sceneDataDocument';
import { describeOracleError, queryOracle } from './oracleSource';

export interface FeedRunResult {
  feed: string; ok: boolean; at: string; elapsedMs: number; error?: string; issues: string[];
  counts: Record<string, { rows: number; kept: number }>; columns: string[]; sample: FeedRow[];
  data?: Record<string, unknown>; documents: SceneDataDocument[];
}
export interface FeedStatus { feed: string; enabled: boolean; ok: boolean; at?: string; elapsedMs?: number; error?: string; issues: string[]; counts: Record<string, { rows: number; kept: number }>; nextAt?: string }
export type FeedQuery = (mapping: FeedMappingConfig, sourceId: string, sql: string, maxRows?: number) => Promise<{ rows: FeedRow[]; columns: string[] }>;

/** Runs one feed: SQL per collection (feed SQL by default), rows → feed data → scene documents. */
export async function runFeed(config: HatcheryConfig, feedId: string, options: { limit?: number; query?: FeedQuery } = {}): Promise<FeedRunResult> {
  const at = new Date().toISOString(), started = Date.now();
  const base: FeedRunResult = { feed: feedId, ok: false, at, elapsedMs: 0, issues: [], counts: {}, columns: [], sample: [], documents: [] };
  const feed = domainFeed(feedId);
  const mapping = config.feeds.find(item => item.feed === feedId);
  if (!feed || !mapping) return { ...base, error: '피드 매핑이 없습니다.' };
  const source = config.sources.find(item => item.id === mapping.sourceId);
  if (!source) return { ...base, error: '데이터 소스를 찾을 수 없습니다.' };
  const query: FeedQuery = options.query ?? (async (_mapping, _sourceId, sql, maxRows) => queryOracle(source, sql, maxRows));
  try {
    const rows: Record<string, FeedRow[]> = {};
    let columns: string[] = [];
    let headerRow: FeedRow | undefined;
    for (const object of feed.objects) {
      const sql = mapping.collections[object.collection]?.sql || mapping.sql;
      if (!sql.trim()) { base.issues.push(`${object.collection}: SQL이 없습니다.`); rows[object.collection] = []; continue; }
      const result = await query(mapping, source.id, sql, options.limit);
      rows[object.collection] = result.rows;
      if (!columns.length) { columns = result.columns; headerRow = result.rows[0]; }
    }
    const mapped = mapRowsToFeedData(feed, mapping, rows, headerRow);
    const documents = feedToSceneDocuments(feedId, mapped.data, { source: 'mes', at });
    const firstCollection = feed.objects[0]?.collection;
    return { ...base, ok: true, elapsedMs: Date.now() - started, issues: [...base.issues, ...mapped.issues], counts: mapped.counts, columns,
      sample: firstCollection ? (rows[firstCollection] ?? []).slice(0, 5) : [], data: mapped.data, documents };
  } catch (error) {
    return { ...base, elapsedMs: Date.now() - started, error: describeOracleError(error) };
  }
}

interface CacheEntry { result: FeedRunResult; nextAt: number }

/** In-process cache: a poll re-runs only the enabled feeds whose interval has elapsed. */
export function createFeedService(readConfig: () => HatcheryConfig, query?: FeedQuery, now: () => number = Date.now) {
  const cache = new Map<string, CacheEntry>();
  return {
    async poll() {
      const config = readConfig();
      const time = now();
      const documents: SceneDataDocument[] = [];
      const feeds: FeedStatus[] = [];
      let nextInSeconds = 60;
      for (const mapping of config.feeds) {
        if (!mapping.enabled) { cache.delete(mapping.feed); feeds.push({ feed: mapping.feed, enabled: false, ok: false, issues: [], counts: {} }); continue; }
        let entry = cache.get(mapping.feed);
        if (!entry || entry.nextAt <= time) {
          const result = await runFeed(config, mapping.feed, { query });
          const previous = entry?.result;
          // Keep the last good documents when a run fails so the screen never blanks out.
          entry = { result: result.ok || !previous ? result : { ...result, documents: previous.documents, data: previous.data }, nextAt: time + mapping.intervalSeconds * 1000 };
          cache.set(mapping.feed, entry);
        }
        documents.push(...entry.result.documents);
        nextInSeconds = Math.min(nextInSeconds, Math.max(1, Math.ceil((entry.nextAt - time) / 1000)));
        feeds.push({ feed: mapping.feed, enabled: true, ok: entry.result.ok, at: entry.result.at, elapsedMs: entry.result.elapsedMs, error: entry.result.error,
          issues: entry.result.issues, counts: entry.result.counts, nextAt: new Date(entry.nextAt).toISOString() });
      }
      return { documents, feeds, nextInSeconds: config.feeds.some(feed => feed.enabled) ? nextInSeconds : 60 };
    },
    invalidate() { cache.clear(); },
  };
}
export type FeedService = ReturnType<typeof createFeedService>;

declare global { var hatcheryFeedService: FeedService | undefined }
/** One service per server process (survives Next.js dev reloads through globalThis). */
export function feedService(readConfig: () => HatcheryConfig) {
  if (!globalThis.hatcheryFeedService) globalThis.hatcheryFeedService = createFeedService(readConfig);
  return globalThis.hatcheryFeedService;
}
