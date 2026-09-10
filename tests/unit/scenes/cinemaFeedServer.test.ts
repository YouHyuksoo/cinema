import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HatcheryConfig } from '@/cinema/feedConfig';

const oracle = vi.hoisted(() => ({ queryOracle: vi.fn(), testOracleSource: vi.fn() }));
vi.mock('@/server/cinema/oracleSource', () => ({ ...oracle, describeOracleError: (error: unknown) => (error instanceof Error ? error.message : String(error)) }));

import { maskConfig, mergePasswords, readConfig, writeConfig } from '@/server/cinema/hatcheryConfig';
import { createFeedService, runFeed } from '@/server/cinema/feedRunner';
import { GET as getConfig, PUT as putConfig } from '@/app/api/cinema/admin/config/route';
import { POST as testSource } from '@/app/api/cinema/admin/sources/test/route';
import { POST as preview } from '@/app/api/cinema/admin/feeds/preview/route';
import { GET as pollFeeds } from '@/app/api/cinema/feed/route';

const config: HatcheryConfig = {
  sources: [{ id: 'mes', name: 'MES', kind: 'oracle', host: 'db', port: 1521, serviceName: 'PDB', user: 'reader', password: 'secret' }],
  feeds: [{ feed: 'production', sourceId: 'mes', enabled: true, intervalSeconds: 30, sql: 'SELECT * FROM V_LINE',
    header: { unit: 'UNIT', target: 'TARGET' }, collections: { lines: { fields: { id: 'ID', label: 'LABEL', value: 'VALUE' } } } }],
};
const rows = [{ ID: '01', LABEL: 'S01', VALUE: 860, TARGET: 1150, UNIT: 'EA' }, { ID: '02', LABEL: 'S02', VALUE: 720, TARGET: 1150, UNIT: 'EA' }];
const request = (method: string, body?: unknown) => new Request('http://localhost:3000/api/cinema/x', { method, headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

let dir = '';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hatchery-')); vi.stubEnv('HATCHERY_CONFIG_PATH', join(dir, 'sources.json')); vi.clearAllMocks(); delete globalThis.hatcheryFeedService; delete globalThis.hatcheryDatabaseHealth; });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe('configuration file', () => {
  it('starts empty, round-trips through disk, masks passwords and keeps them when the client sends none', () => {
    expect(readConfig()).toEqual({ config: { sources: [], feeds: [] } });
    writeConfig(config);
    expect(readConfig().config).toEqual(config);
    expect(JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')).sources[0].password).toBe('secret');
    expect(maskConfig(config).sources[0]).toEqual({ id: 'mes', name: 'MES', kind: 'oracle', host: 'db', port: 1521, serviceName: 'PDB', user: 'reader', hasPassword: true });
    const merged = mergePasswords({ ...config, sources: [{ ...config.sources[0], password: '' }] }, config);
    expect(merged.sources[0].password).toBe('secret');
  });
  it('reports unreadable files without throwing', () => {
    writeConfig(config);
    const path = join(dir, 'sources.json');
    writeFileSync(path, '{ not json');
    expect(readConfig().error).toContain('JSON');
    writeFileSync(path, JSON.stringify({ sources: [{ id: 'x' }] }));
    expect(readConfig().error).toContain('host');
  });
});

describe('feed runner', () => {
  it('maps query rows into scene documents and reports counts and issues', async () => {
    const query = vi.fn(async () => ({ rows: [...rows, { ID: '', LABEL: 'bad' }], columns: ['ID', 'LABEL', 'VALUE', 'TARGET', 'UNIT'] }));
    const result = await runFeed(config, 'production', { query });
    expect(result.ok).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({ scene: 'bars', source: 'mes', data: { unit: 'EA', target: 1150, lines: [{ id: '01', label: 'S01', value: 860 }, { id: '02', value: 720 }] } });
    expect(result.counts.lines).toEqual({ rows: 3, kept: 2 });
    expect(result.issues).toHaveLength(1);
    expect(result.sample).toHaveLength(3);
  });
  it('returns an error result for missing mappings, missing sources and failing queries', async () => {
    expect((await runFeed(config, 'quality')).error).toContain('매핑');
    expect((await runFeed({ ...config, sources: [] }, 'production')).error).toContain('소스');
    const failing = await runFeed(config, 'production', { query: async () => { throw new Error('ORA-00942: table or view does not exist'); } });
    expect(failing.ok).toBe(false);
    expect(failing.error).toContain('ORA-00942');
  });
  it('caches per interval and keeps the last good documents when a later run fails', async () => {
    let time = 1_000_000;
    const query = vi.fn(async () => ({ rows, columns: [] }));
    const service = createFeedService(() => config, query, () => time);
    const first = await service.poll();
    expect(first.documents).toHaveLength(1);
    expect(first.nextInSeconds).toBe(30);
    await service.poll();
    expect(query).toHaveBeenCalledTimes(1);
    time += 31_000;
    query.mockRejectedValueOnce(new Error('timeout'));
    const third = await service.poll();
    expect(query).toHaveBeenCalledTimes(2);
    expect(third.documents).toHaveLength(1);
    expect(third.feeds[0]).toMatchObject({ ok: false, error: 'timeout' });
    const disabled = createFeedService(() => ({ ...config, feeds: [{ ...config.feeds[0], enabled: false }] }), query);
    expect(await disabled.poll()).toMatchObject({ documents: [], nextInSeconds: 60, feeds: [{ enabled: false }] });
  });
});

describe('admin and feed routes', () => {
  it('reads and writes the masked configuration and rejects foreign origins', async () => {
    expect(await (await getConfig(request('GET'))).json()).toEqual({ sources: [], feeds: [] });
    const saved = await (await putConfig(request('PUT', config))).json();
    expect(saved.sources[0]).toMatchObject({ id: 'mes', hasPassword: true });
    expect(JSON.stringify(saved)).not.toContain('secret');
    const again = await (await putConfig(request('PUT', { ...config, sources: [{ ...config.sources[0], password: '' }] }))).json();
    expect(again.sources[0].hasPassword).toBe(true);
    expect(readConfig().config.sources[0].password).toBe('secret');
    expect((await putConfig(request('PUT', { sources: [{ id: 'x' }] }))).status).toBe(400);
    const foreign = new Request('http://localhost:3000/api/cinema/x', { headers: { origin: 'https://evil.example' } });
    expect((await getConfig(foreign)).status).toBe(403);
  });
  it('tests a saved source without echoing the password', async () => {
    writeConfig(config);
    oracle.testOracleSource.mockResolvedValueOnce({ ok: true, elapsedMs: 12, version: '19.0' });
    const body = await (await testSource(request('POST', { sourceId: 'mes' }))).json();
    expect(body).toEqual({ ok: true, elapsedMs: 12, version: '19.0' });
    expect(oracle.testOracleSource).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret' }));
    expect(await (await testSource(request('POST', { ...config.sources[0], id: 'new', password: '' }))).json()).toMatchObject({ ok: false });
  });
  it('previews a saved or unsaved mapping with limited rows and polls documents', async () => {
    writeConfig(config);
    oracle.queryOracle.mockResolvedValue({ rows, columns: ['ID'], elapsedMs: 3, truncated: false });
    const saved = await (await preview(request('POST', { feed: 'production' }))).json();
    expect(saved.ok).toBe(true);
    expect(oracle.queryOracle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'mes' }), 'SELECT * FROM V_LINE', 50);
    const unsaved = await (await preview(request('POST', { mapping: { ...config.feeds[0], sql: 'SELECT 2 FROM DUAL' } }))).json();
    expect(unsaved.ok).toBe(true);
    expect(oracle.queryOracle).toHaveBeenLastCalledWith(expect.anything(), 'SELECT 2 FROM DUAL', 50);
    oracle.testOracleSource.mockResolvedValueOnce({ok:true,elapsedMs:2,version:'19.0'});
    const polled = await (await pollFeeds(request('GET'))).json();
    expect(polled.database).toMatchObject({total:1,connected:1});
    expect(JSON.stringify(polled.database)).not.toMatch(/secret|reader|PDB/);
    expect(polled.documents[0]).toMatchObject({ scene: 'bars' });
    expect(polled.feeds[0]).toMatchObject({ feed: 'production', ok: true });
    expect(polled.nextInSeconds).toBeGreaterThan(0);
  });
});
