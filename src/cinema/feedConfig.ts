import { DOMAIN_FEEDS, type DomainFeed } from './domainFeeds';

/**
 * Data source and feed mapping configuration. Stored server-side as JSON (never committed);
 * the admin screen edits it. A mapping says which SQL to run and which column feeds which
 * contract field, so no code changes are needed to attach another database.
 */
export interface DataSourceConfig {
  id: string;
  name: string;
  kind: 'oracle';
  host: string;
  port: number;
  serviceName: string;
  user: string;
  password: string;
}
export interface CollectionMapping {
  /** Overrides the feed SQL for this collection (feeds with several collections). */
  sql?: string;
  /** Contract field (id, label, declared fields, extra keys) → column name in the result set. */
  fields: Record<string, string>;
}
export interface FeedMappingConfig {
  feed: string;
  sourceId: string;
  enabled: boolean;
  intervalSeconds: number;
  sql: string;
  /** Header field → column name; values come from the first row of the feed SQL. */
  header: Record<string, string>;
  collections: Record<string, CollectionMapping>;
}
export interface HatcheryConfig { sources: DataSourceConfig[]; feeds: FeedMappingConfig[] }

export const EMPTY_HATCHERY_CONFIG: HatcheryConfig = { sources: [], feeds: [] };
export const MIN_FEED_INTERVAL_SECONDS = 5;
export const MAX_FEED_ROWS = 2000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const stringMap = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, column] of Object.entries(value)) { if (typeof column !== 'string') return undefined; if (column.trim()) out[key] = column.trim(); }
  return out;
};

/** SQL typed into the admin screen is executed as-is, so only single read-only statements pass. */
export function assertSelectOnly(sql: string): string | undefined {
  const body = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!body) return 'SQL이 비어 있습니다.';
  if (!/^(select|with)\b/i.test(body)) return 'SELECT 또는 WITH로 시작하는 조회문만 실행할 수 있습니다.';
  if (body.includes(';')) return '세미콜론(;)은 사용할 수 없습니다. 조회문 하나만 입력해 주세요.';
  if (/\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|execute|begin|declare)\b/i.test(body)) return '조회문 안에 변경·실행 구문을 넣을 수 없습니다.';
  return undefined;
}

export function parseDataSource(input: unknown): { ok: true; source: DataSourceConfig } | { ok: false; reason: string } {
  if (!isRecord(input)) return { ok: false, reason: '데이터 소스는 객체여야 합니다.' };
  const { id, name, host, port, serviceName, user, password } = input;
  if (!isText(id)) return { ok: false, reason: '데이터 소스 id가 필요합니다.' };
  if (!isText(host) || !isText(serviceName) || !isText(user)) return { ok: false, reason: `${id}: host, serviceName, user는 비어 있을 수 없습니다.` };
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return { ok: false, reason: `${id}: port는 1~65535 사이여야 합니다.` };
  return { ok: true, source: { id: id.trim(), name: isText(name) ? name.trim() : id.trim(), kind: 'oracle', host: host.trim(), port: portNumber,
    serviceName: serviceName.trim(), user: user.trim(), password: typeof password === 'string' ? password : '' } };
}

export function parseFeedMapping(input: unknown): { ok: true; mapping: FeedMappingConfig } | { ok: false; reason: string } {
  if (!isRecord(input)) return { ok: false, reason: '피드 매핑은 객체여야 합니다.' };
  const { feed, sourceId, enabled, intervalSeconds, sql, header, collections } = input;
  if (!isText(feed) || !DOMAIN_FEEDS.some(item => item.feed === feed)) return { ok: false, reason: `알 수 없는 피드입니다: ${String(feed)}` };
  const interval = Number(intervalSeconds);
  if (!Number.isFinite(interval) || interval < MIN_FEED_INTERVAL_SECONDS) return { ok: false, reason: `${feed}: 갱신 주기는 ${MIN_FEED_INTERVAL_SECONDS}초 이상이어야 합니다.` };
  const headerMap = stringMap(header ?? {});
  if (!headerMap) return { ok: false, reason: `${feed}: header 매핑이 잘못됐습니다.` };
  if (!isRecord(collections ?? {})) return { ok: false, reason: `${feed}: collections 매핑이 잘못됐습니다.` };
  const collectionMaps: Record<string, CollectionMapping> = {};
  for (const [collection, value] of Object.entries((collections ?? {}) as Record<string, unknown>)) {
    if (!isRecord(value)) return { ok: false, reason: `${feed}.${collection}: 매핑은 객체여야 합니다.` };
    const fields = stringMap(value.fields ?? {});
    if (!fields) return { ok: false, reason: `${feed}.${collection}: fields 매핑이 잘못됐습니다.` };
    collectionMaps[collection] = { ...(isText(value.sql) ? { sql: value.sql } : {}), fields };
  }
  return { ok: true, mapping: { feed, sourceId: typeof sourceId === 'string' ? sourceId.trim() : '', enabled: enabled === true,
    intervalSeconds: Math.round(interval), sql: typeof sql === 'string' ? sql : '', header: headerMap, collections: collectionMaps } };
}

export function parseHatcheryConfig(input: unknown): { ok: true; config: HatcheryConfig } | { ok: false; reason: string } {
  if (!isRecord(input)) return { ok: false, reason: '설정은 객체여야 합니다.' };
  const sources: DataSourceConfig[] = [];
  for (const raw of Array.isArray(input.sources) ? input.sources : []) {
    const parsed = parseDataSource(raw);
    if (!parsed.ok) return parsed;
    if (sources.some(source => source.id === parsed.source.id)) return { ok: false, reason: `데이터 소스 id가 중복됩니다: ${parsed.source.id}` };
    sources.push(parsed.source);
  }
  const feeds: FeedMappingConfig[] = [];
  for (const raw of Array.isArray(input.feeds) ? input.feeds : []) {
    const parsed = parseFeedMapping(raw);
    if (!parsed.ok) return parsed;
    if (feeds.some(feed => feed.feed === parsed.mapping.feed)) return { ok: false, reason: `피드 매핑이 중복됩니다: ${parsed.mapping.feed}` };
    if (parsed.mapping.enabled && !sources.some(source => source.id === parsed.mapping.sourceId)) return { ok: false, reason: `${parsed.mapping.feed}: 활성 피드에는 존재하는 데이터 소스가 필요합니다.` };
    feeds.push(parsed.mapping);
  }
  return { ok: true, config: { sources, feeds } };
}

/** Admin-screen starting point: every contract field mapped to an upper-case column of the same name. */
export function mappingTemplate(feed: DomainFeed): FeedMappingConfig {
  const upper = (field: string) => field.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  const collections: Record<string, CollectionMapping> = {};
  for (const object of feed.objects) {
    const fields: Record<string, string> = { id: 'ID', label: 'LABEL' };
    for (const field of object.fields) fields[field.field] = upper(field.field);
    for (const key of Object.keys(object.extra ?? {})) fields[key] = upper(key);
    collections[object.collection] = { fields };
  }
  return { feed: feed.feed, sourceId: '', enabled: false, intervalSeconds: feed.refresh === 'fast' ? 10 : feed.refresh === 'event' ? 60 : 30,
    sql: '', header: Object.fromEntries(feed.header.map(field => [field.field, upper(field.field)])), collections };
}
