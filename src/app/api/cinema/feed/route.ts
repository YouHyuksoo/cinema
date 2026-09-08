import { rejectExternalRequest } from '@/server/cinema/openai';
import { readConfig } from '@/server/cinema/hatcheryConfig';
import { feedService } from '@/server/cinema/feedRunner';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Browser poll: scene documents from every enabled feed plus per-feed status and the next poll delay. */
export async function GET(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const { error } = readConfig();
  const result = await feedService(() => readConfig().config).poll();
  return Response.json({ ...result, ...(error ? { error } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}
