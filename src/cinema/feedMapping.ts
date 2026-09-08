import type { DomainFeed, DomainObjectType } from './domainFeeds';
import type { CollectionMapping, FeedMappingConfig } from './feedConfig';
import { validateSceneField, validateSceneObjectFields, type SceneFieldDescriptor } from './sceneField';

export type FeedRow = Record<string, unknown>;
export interface FeedMappingResult { data: Record<string, unknown>; issues: string[]; counts: Record<string, { rows: number; kept: number }> }

const columnValue = (row: FeedRow, column: string) => {
  if (column in row) return row[column];
  const key = Object.keys(row).find(name => name.toLowerCase() === column.toLowerCase());
  return key === undefined ? undefined : row[key];
};
const blank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && !value.trim());

/** Database cells arrive as strings, numbers or Dates; coerce them to what the descriptor expects. */
export function coerceFieldValue(descriptor: SceneFieldDescriptor | undefined, value: unknown): unknown {
  if (blank(value)) return undefined;
  if (value instanceof Date) return descriptor?.kind === 'text' ? value.toISOString() : value.getTime();
  if (!descriptor) {
    if (typeof value === 'string') { const trimmed = value.trim(); if (/^[[{]/.test(trimmed)) { try { return JSON.parse(trimmed); } catch { return trimmed; } } return trimmed; }
    return value;
  }
  if (descriptor.kind === 'text') return String(value).trim();
  if (descriptor.kind === 'number[]') {
    if (Array.isArray(value)) return value.map(Number);
    const text = String(value).trim();
    try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(Number); } catch { /* fall through to separators */ }
    return text.split(/[,\s;|]+/).filter(Boolean).map(Number);
  }
  return typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
}

function mapObject(object: DomainObjectType, mapping: CollectionMapping, row: FeedRow): { ok: true; item: Record<string, unknown> } | { ok: false; reason: string } {
  const item: Record<string, unknown> = {};
  const descriptors = new Map(object.fields.map(field => [field.field, field]));
  for (const [field, column] of Object.entries(mapping.fields)) {
    const value = coerceFieldValue(field === 'id' || field === 'label' ? { field, label: field, kind: 'text' } : descriptors.get(field), columnValue(row, column));
    if (value !== undefined) item[field] = value;
  }
  if (typeof item.id !== 'string' || !item.id) return { ok: false, reason: 'id 컬럼이 비어 있습니다.' };
  if (typeof item.label !== 'string' || !item.label) item.label = item.id;
  const checked = validateSceneObjectFields(object.fields, item, { required: true });
  if (!checked.ok) return { ok: false, reason: `${item.id}: ${checked.reason}` };
  for (const [key, extra] of Object.entries(object.extra ?? {})) {
    if (item[key] === undefined && !extra.optional) return { ok: false, reason: `${item.id}: ${extra.label}(${key}) 값이 없습니다.` };
  }
  return { ok: true, item };
}

/**
 * Turns result rows into feed data: the header from the first feed row, each collection from
 * its rows. Invalid rows are dropped and reported; duplicates keep the first occurrence.
 */
export function mapRowsToFeedData(feed: DomainFeed, mapping: FeedMappingConfig, rows: Record<string, FeedRow[]>, headerRow?: FeedRow): FeedMappingResult {
  const issues: string[] = [];
  const data: Record<string, unknown> = {};
  const counts: Record<string, { rows: number; kept: number }> = {};
  const first = headerRow ?? rows[feed.objects[0]?.collection ?? '']?.[0];
  for (const field of feed.header) {
    const column = mapping.header[field.field];
    const value = column && first ? coerceFieldValue(field, columnValue(first, column)) : undefined;
    if (value === undefined) { if (!field.optional) issues.push(`헤더 ${field.label}(${field.field})${column ? `: 컬럼 ${column} 값이 없습니다.` : ' 매핑이 없습니다.'}`); continue; }
    const checked = validateSceneField(field, value);
    if (!checked.ok) { issues.push(`헤더 ${checked.reason}`); continue; }
    data[field.field] = value;
  }
  for (const object of feed.objects) {
    const collectionMapping = mapping.collections[object.collection];
    const source = rows[object.collection] ?? [];
    const items: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    if (!collectionMapping) { issues.push(`${object.collection} 매핑이 없습니다.`); data[object.collection] = items; counts[object.collection] = { rows: source.length, kept: 0 }; continue; }
    for (const row of source) {
      const mapped = mapObject(object, collectionMapping, row);
      if (!mapped.ok) { issues.push(`${object.collection}: ${mapped.reason}`); continue; }
      const id = mapped.item.id as string;
      if (seen.has(id)) { issues.push(`${object.collection}: 중복 id ${id} (뒤 행 무시)`); continue; }
      seen.add(id); items.push(mapped.item);
    }
    data[object.collection] = items;
    counts[object.collection] = { rows: source.length, kept: items.length };
  }
  return { data, issues, counts };
}
