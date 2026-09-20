import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET, PUT } from '@/app/api/cinema/admin/typesafe/route';
import { POST as testConnection } from '@/app/api/cinema/admin/typesafe/test/route';
import { mergePasswords, readConfig, writeConfig, maskConfig } from '@/server/cinema/hatcheryConfig';
import { typesafeStatus } from '@/server/cinema/typesafeClient';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cinema-jev-test-'));
  vi.stubEnv('HATCHERY_CONFIG_PATH', join(dir, 'sources.json'));
  vi.stubEnv('TYPESAFE_API_KEY', ''); vi.stubEnv('TYPESAFE_MODE', 'off');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(dir, { recursive: true, force: true }); });
const request = (body?: unknown) => new Request('http://localhost:3010/api/cinema/admin/typesafe', {
  method: body ? 'PUT' : 'GET', ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
});
describe('Jev settings persistence', () => {
  it('saves separately from chat AI and never returns the secret', async () => {
    const response = await PUT(request({ apiKey: 'jev-secret', mode: 'shadow', model: 'jev-latest' }));
    expect(response.status).toBe(200);
    const body = await response.json(); expect(JSON.stringify(body)).not.toContain('jev-secret');
    expect(body.settings).toMatchObject({ hasApiKey: true, mode: 'shadow', keySource: 'config' });
    expect(readConfig().config.typesafe?.apiKey).toBe('jev-secret');
    expect(typesafeStatus()).toMatchObject({ configured: true, mode: 'shadow' });
    expect(JSON.stringify(await GET(request()).json())).not.toContain('jev-secret');
  });
  it('keeps a blank key and survives unrelated data source saves', async () => {
    await PUT(request({ apiKey: 'jev-secret', mode: 'shadow', model: 'jev-latest' }));
    await PUT(request({ apiKey: '', mode: 'on', model: 'jev-latest' }));
    const current = readConfig().config;
    writeConfig(mergePasswords({ sources: [], feeds: [] }, current));
    expect(readConfig().config.typesafe).toMatchObject({ apiKey: 'jev-secret', mode: 'on' });
    expect(JSON.stringify(maskConfig(readConfig().config))).not.toContain('jev-secret');
  });
  it('validates configuration and refuses activation without a key', async () => {
    for (const body of [{ mode: 'bad', model: 'jev-latest' }, { mode: 'on', model: 'jev-latest', apiKey: '' }, { mode: 'off', model: 'bad model' }]) {
      expect((await PUT(request(body))).status).toBe(400);
    }
  });
  it('uses environment credentials only when a saved key is absent', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'env-secret');
    await PUT(request({ apiKey: '', mode: 'shadow', model: 'jev-latest' }));
    expect(await GET(request()).json()).toMatchObject({ settings: { keySource: 'env', hasApiKey: true, mode: 'shadow' } });
  });
  it('tests the draft key without saving it or executing a command', async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer draft-secret');
      return Response.json({ model: 'jev-1.13.0', answers: { connection: { type: 'noul', noul: 0.99 } } });
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await testConnection(request({ apiKey: 'draft-secret', mode: 'off', model: 'jev-latest' }));
    expect(await response.json()).toMatchObject({ ok: true, model: 'jev-1.13.0' });
    expect(readConfig().config.typesafe).toBeUndefined(); expect(fetcher).toHaveBeenCalledOnce();
  });
});
