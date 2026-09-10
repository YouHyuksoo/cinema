import { describe, expect, it, vi } from 'vitest';
import { createSceneDataStore } from '@/cinema/sceneDataStore';
import { FEED_POLL_PATH, startFeedPolling, type FeedPollSummary } from '@/cinema/feedPolling';

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body }) as unknown as Response;
const html = (status = 200) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': 'text/html' }), json: async () => ({}) }) as unknown as Response;
const document = { scene: 'bars', version: 1, source: 'mes', at: '2026-09-08T09:00:00+09:00', data: { unit: 'EA', target: 1150, lines: [{ id: '01', label: 'S01', value: 860 }] } };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function harness() {
  const scheduled: { callback: () => void; ms: number }[] = [];
  const schedule = vi.fn((callback: () => void, ms: number) => { scheduled.push({ callback, ms }); return () => { scheduled.length = 0; }; });
  const statuses: FeedPollSummary[] = [];
  return { scheduled, schedule, statuses, onStatus: (summary: FeedPollSummary) => statuses.push(summary) };
}

describe('feed polling adapter', () => {
  it('carries database evidence through the existing polling channel', async () => {
    const h=harness();
    const database={checkedAt:new Date().toISOString(),total:1,connected:1};
    const stop=startFeedPolling(createSceneDataStore(), { fetch:async()=>json({database,documents:[],feeds:[]}),basePath:'',schedule:h.schedule,onStatus:h.onStatus });
    await flush();
    expect(h.statuses[0]).toMatchObject({database});
    stop();
  });
  it('applies polled documents, reports status and schedules the next poll from the server hint', async () => {
    const store = createSceneDataStore();
    const h = harness();
    const fetcher = vi.fn(async () => json({ documents: [document], feeds: [{ feed: 'production', enabled: true, ok: true, issues: [], counts: {} }], nextInSeconds: 12 }));
    startFeedPolling(store, { fetch: fetcher, basePath: '/cinema', onStatus: h.onStatus, schedule: h.schedule });
    await flush();
    expect(fetcher).toHaveBeenCalledWith('/cinema' + FEED_POLL_PATH, { cache: 'no-store' });
    expect(store.get().production.lines[0].id).toBe('01');
    expect(store.provenance('production')?.source).toBe('mes');
    expect(h.statuses[0]).toMatchObject({ mode: 'server', applied: 1, rejected: [] });
    expect(h.scheduled[0].ms).toBe(12000);
    h.scheduled[0].callback(); await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops quietly on a static deployment (404 or HTML) and keeps the defaults', async () => {
    for (const reply of [html(404), html(200)]) {
      const store = createSceneDataStore();
      const h = harness();
      startFeedPolling(store, { fetch: async () => reply, basePath: '', onStatus: h.onStatus, schedule: h.schedule });
      await flush();
      expect(h.statuses[0].mode).toBe('static');
      expect(h.scheduled).toHaveLength(0);
      expect(store.get().production.lines).toHaveLength(5);
    }
  });

  it('retries after network or server errors and reports rejected documents', async () => {
    const store = createSceneDataStore();
    const h = harness();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({ error: 'x' }, 500))
      .mockResolvedValueOnce(json({ documents: [{ ...document, scene: 'gears' }], feeds: [], nextInSeconds: 1 }));
    startFeedPolling(store, { fetch: fetcher, basePath: '', onStatus: h.onStatus, schedule: h.schedule, minIntervalSeconds: 5 });
    await flush();
    expect(h.statuses[0]).toMatchObject({ mode: 'error', error: 'offline' });
    expect(h.scheduled[0].ms).toBe(30000);
    h.scheduled[0].callback(); await flush();
    expect(h.statuses[1]).toMatchObject({ mode: 'error' });
    h.scheduled[1].callback(); await flush();
    expect(h.statuses[2]).toMatchObject({ mode: 'server', applied: 0 });
    expect(h.statuses[2].rejected[0]).toContain('gears');
    expect(h.scheduled[2].ms).toBe(5000);
  });

  it('does nothing without fetch and stops when asked', async () => {
    const store = createSceneDataStore();
    const h = harness();
    expect(() => startFeedPolling(store, { fetch: undefined, basePath: '', onStatus: h.onStatus, schedule: h.schedule })()).not.toThrow();
    const fetcher = vi.fn(async () => json({ documents: [], feeds: [], nextInSeconds: 10 }));
    const stop = startFeedPolling(store, { fetch: fetcher, basePath: '', schedule: h.schedule });
    await flush();
    stop();
    expect(h.scheduled).toHaveLength(0);
  });
});
