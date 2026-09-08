import { parseFeedMapping } from '@/cinema/feedConfig';
import { rejectExternalRequest } from '@/server/cinema/openai';
import { readConfig } from '@/server/cinema/hatcheryConfig';
import { runFeed } from '@/server/cinema/feedRunner';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Body: { feed } to preview a saved mapping, or { mapping } to preview an unsaved one (limited rows). */
export async function POST(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  let raw: { feed?: unknown; mapping?: unknown };
  try { raw = await request.json(); } catch { return Response.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 }); }
  const { config, error } = readConfig();
  if (error) return Response.json({ error }, { status: 500 });
  let feedId: string;
  let effective = config;
  if (raw?.mapping !== undefined) {
    const parsed = parseFeedMapping(raw.mapping);
    if (!parsed.ok) return Response.json({ error: parsed.reason }, { status: 400 });
    feedId = parsed.mapping.feed;
    effective = { ...config, feeds: [...config.feeds.filter(feed => feed.feed !== feedId), parsed.mapping] };
  }
  else if (typeof raw?.feed === 'string') feedId = raw.feed;
  else return Response.json({ error: 'feed 또는 mapping이 필요합니다.' }, { status: 400 });
  const result = await runFeed(effective, feedId, { limit: 50 });
  return Response.json(result);
}
