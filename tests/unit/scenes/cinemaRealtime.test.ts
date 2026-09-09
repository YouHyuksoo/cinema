import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/cinema/realtime/route';
const request = (sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', voice = 'cedar') => new Request(`http://localhost:3000/api/cinema/realtime?voice=${voice}`, {
  method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/sdp' }, body: sdp,
});
// No saved AI settings: point the config file at a path that does not exist so only the environment applies.
beforeEach(() => { vi.stubEnv('HATCHERY_CONFIG_PATH', join(tmpdir(), `hatchery-none-${process.pid}.json`)); vi.stubEnv('OPENAI_API_KEY', 'test-server-secret'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Realtime session proxy', () => {
  it('sends server-authenticated multipart SDP and returns only the answer', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('v=0\r\nanswer'));
    const response = await POST(request());
    expect(await response.text()).toBe('v=0\r\nanswer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/realtime/calls');
    const session = JSON.parse((init!.body as FormData).get('session') as string);
    expect(session.audio.output.voice).toBe('cedar');
    expect(session.audio.input.turn_detection.interrupt_response).toBe(true);
    expect(session.tools[0].parameters.properties.chapter.enum).toContain('spc');
  });
  it('rejects invalid SDP and arbitrary voices before spending', async () => {
    expect((await POST(request('bad'))).status).toBe(400);
    expect((await POST(request(undefined, 'bad'))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
