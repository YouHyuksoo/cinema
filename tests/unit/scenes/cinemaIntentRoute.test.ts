import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET, POST } from '@/app/api/cinema/intent/route';
import { ChatBody } from '@/server/cinema/openai';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => vi.stubEnv('HATCHERY_CONFIG_PATH', join(tmpdir(), `cinema-intent-unit-${crypto.randomUUID()}.json`)));
const request = (body: unknown, origin = 'http://localhost:3010') => new Request('http://localhost:3010/api/cinema/intent', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
describe('intent HTTP boundary', () => {
  it('reports status without exposing the key', async () => {
    vi.stubEnv('TYPESAFE_MODE', 'on'); vi.stubEnv('TYPESAFE_API_KEY', 'private-test-key');
    const response = GET(new Request('http://localhost:3010/api/cinema/intent'));
    expect(await response.json()).toMatchObject({ mode: 'on', configured: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects external origins before any paid request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await POST(request({ message: '메뉴' }, 'https://external.invalid'))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ message: '' }, { message: 'a'.repeat(1201) }, { message: '메뉴', screenState: { playing: 'yes' } }])('rejects invalid input', async body => {
    expect((await POST(request(body))).status).toBe(400);
  });
  it('rejects oversized requests', async () => {
    expect((await POST(request({ message: 'a'.repeat(8001) }))).status).toBe(413);
  });
  it('does not switch to another provider when TypeSafe is enabled but unconfigured', async () => {
    vi.stubEnv('TYPESAFE_MODE', 'on'); vi.stubEnv('TYPESAFE_API_KEY', '');
    const response = await POST(request({ message: '온습도 보는 곳 띄워' }));
    expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ error: expect.stringContaining('키') });
  });
  it('strips unknown state fields and disables caching', async () => {
    vi.stubEnv('TYPESAFE_MODE', 'off');
    const response = await POST(request({ message: '메뉴', screenState: { scene: 'wave', apiKey: 'never-forward' } }));
    expect(await response.json()).toEqual({ kind: 'disabled' }); expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('preserves the read-only decision across the assistant request boundary', () => {
    expect(ChatBody.parse({ message: '온습도 화면 설명해 줘', readOnly: true }).readOnly).toBe(true);
  });
});
