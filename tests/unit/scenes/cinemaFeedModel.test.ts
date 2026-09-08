import { describe, expect, it } from 'vitest';
import { assertSelectOnly, mappingTemplate, parseFeedMapping, parseHatcheryConfig, type FeedMappingConfig } from '@/cinema/feedConfig';
import { coerceFieldValue, mapRowsToFeedData } from '@/cinema/feedMapping';
import { feedToSceneDocuments } from '@/cinema/feedScenes';
import { domainFeed, feedExample } from '@/cinema/domainFeeds';
import { createSceneDataStore } from '@/cinema/sceneDataStore';

const source = { id: 'mes', name: 'MES', kind: 'oracle', host: 'db.local', port: 1521, serviceName: 'PDB', user: 'reader', password: 'secret' };
const productionMapping: FeedMappingConfig = { feed: 'production', sourceId: 'mes', enabled: true, intervalSeconds: 30,
  sql: 'SELECT LINE_CODE, LINE_NAME, QTY, PLAN_QTY FROM V_LINE', header: { unit: 'UOM', target: 'PLAN_QTY' },
  collections: { lines: { fields: { id: 'LINE_CODE', label: 'LINE_NAME', value: 'QTY' } } } };

describe('feed configuration', () => {
  it('parses sources and feed mappings and rejects broken ones', () => {
    const parsed = parseHatcheryConfig({ sources: [source], feeds: [productionMapping] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) { expect(parsed.config.sources[0].password).toBe('secret'); expect(parsed.config.feeds[0].intervalSeconds).toBe(30); }
    expect(parseHatcheryConfig({ sources: [{ ...source, port: 0 }] }).ok).toBe(false);
    expect(parseHatcheryConfig({ sources: [source, source] }).ok).toBe(false);
    expect(parseHatcheryConfig({ sources: [], feeds: [productionMapping] }).ok).toBe(false);
    expect(parseHatcheryConfig({ sources: [source], feeds: [{ ...productionMapping, enabled: false, sourceId: '' }] }).ok).toBe(true);
    expect(parseFeedMapping({ ...productionMapping, feed: 'nope' }).ok).toBe(false);
    expect(parseFeedMapping({ ...productionMapping, intervalSeconds: 1 }).ok).toBe(false);
    expect(parseFeedMapping({ ...productionMapping, collections: { lines: { fields: { id: 3 } } } }).ok).toBe(false);
  });

  it('allows only single read-only statements', () => {
    expect(assertSelectOnly('SELECT 1 FROM DUAL')).toBeUndefined();
    expect(assertSelectOnly('  with x as (select 1 from dual) select * from x')).toBeUndefined();
    expect(assertSelectOnly('-- comment\nSELECT 1 FROM DUAL')).toBeUndefined();
    expect(assertSelectOnly('')).toBeDefined();
    expect(assertSelectOnly('DELETE FROM T')).toBeDefined();
    expect(assertSelectOnly('SELECT 1 FROM DUAL; DROP TABLE T')).toBeDefined();
    expect(assertSelectOnly('SELECT * FROM T WHERE 1=1 UNION ALL SELECT * FROM (DELETE FROM X)')).toBeDefined();
  });

  it('builds a mapping template from the feed declaration', () => {
    const template = mappingTemplate(domainFeed('process')!);
    expect(template.header).toEqual({ title: 'TITLE', demandPerHour: 'DEMAND_PER_HOUR' });
    expect(template.collections.nodes.fields).toMatchObject({ id: 'ID', label: 'LABEL', code: 'CODE', capacityPerHour: 'CAPACITY_PER_HOUR', position: 'POSITION' });
    expect(Object.keys(template.collections)).toEqual(['nodes', 'links']);
    expect(template.enabled).toBe(false);
  });
});

describe('row mapping', () => {
  const feed = domainFeed('production')!;
  it('coerces database cells to descriptor kinds', () => {
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number' }, '1,234')).toBe(1234);
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number' }, 12)).toBe(12);
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number[]' }, '[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number[]' }, '1, 2; 3')).toEqual([1, 2, 3]);
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'text' }, 42)).toBe('42');
    expect(coerceFieldValue(undefined, '{"x":1,"y":2,"z":3}')).toEqual({ x: 1, y: 2, z: 3 });
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number' }, new Date(1000))).toBe(1000);
    expect(coerceFieldValue({ field: 'v', label: 'v', kind: 'number' }, null)).toBeUndefined();
  });

  it('maps rows to feed data, drops invalid rows and reports every issue', () => {
    const rows = { lines: [
      { LINE_CODE: '01', LINE_NAME: 'S01', QTY: '860', PLAN_QTY: 1150, UOM: 'EA' },
      { line_code: '02', line_name: 'S02', qty: 720, plan_qty: 1150, uom: 'EA' },
      { LINE_CODE: '03', LINE_NAME: 'S03', QTY: 'abc', PLAN_QTY: 1150, UOM: 'EA' },
      { LINE_CODE: '', LINE_NAME: 'S04', QTY: 5, PLAN_QTY: 1150, UOM: 'EA' },
      { LINE_CODE: '01', LINE_NAME: 'dup', QTY: 1, PLAN_QTY: 1150, UOM: 'EA' },
    ] };
    const result = mapRowsToFeedData(feed, productionMapping, rows);
    expect(result.data).toMatchObject({ unit: 'EA', target: 1150 });
    expect(result.data.lines).toEqual([{ id: '01', label: 'S01', value: 860 }, { id: '02', label: 'S02', value: 720 }]);
    expect(result.counts.lines).toEqual({ rows: 5, kept: 2 });
    expect(result.issues).toHaveLength(3);
    expect(result.issues.join(' ')).toContain('03');
    expect(result.issues.join(' ')).toContain('중복');
  });

  it('reports missing header mappings and missing collection mappings', () => {
    const result = mapRowsToFeedData(feed, { ...productionMapping, header: {}, collections: {} }, { lines: [] });
    expect(result.issues.some(issue => issue.includes('unit'))).toBe(true);
    expect(result.issues.some(issue => issue.includes('lines'))).toBe(true);
    expect(result.data.lines).toEqual([]);
  });
});

describe('feed to scene documents', () => {
  const envelope = { source: 'mes' as const, at: '2026-09-08T09:00:00+09:00' };
  it('converts the generated examples of migrated feeds into documents the store accepts', () => {
    const store = createSceneDataStore();
    for (const [feedId, scene] of [['production', 'bars'], ['environment', 'wave'], ['process', 'network'], ['quality', 'spc'], ['energy', 'energy'], ['inspection', 'product']] as const) {
      const example = feedExample(domainFeed(feedId)!).data as Record<string, unknown>;
      const documents = feedToSceneDocuments(feedId, example, envelope);
      expect(documents.map(document => document.scene), feedId).toEqual([scene]);
      const result = store.replace(documents[0]);
      expect(result.ok, `${feedId}: ${!result.ok ? result.reason : ''}`).toBe(true);
    }
    expect(store.provenance('production')).toEqual(envelope);
  });
  it('produces nothing for feeds whose scenes are not migrated yet', () => {
    for (const feedId of ['equipment', 'workOrder', 'machine']) expect(feedToSceneDocuments(feedId, feedExample(domainFeed(feedId)!).data as Record<string, unknown>, envelope)).toEqual([]);
    expect(feedToSceneDocuments('energy', { name: 'x', readings: [] }, envelope)).toEqual([]);
  });
});
