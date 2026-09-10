import { rejectExternalRequest } from '@/server/cinema/openai';
import { readConfig } from '@/server/cinema/hatcheryConfig';
import { feedService } from '@/server/cinema/feedRunner';
import { databaseHealthService } from '@/server/cinema/databaseHealth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Browser poll: scene documents from every enabled feed plus per-feed status and the next poll delay. */
export async function GET(request: Request) {
  const rejected = rejectExternalRequest(request); if (rejected) return rejected;
  const { config, error } = readConfig();
  const [result,database] = await Promise.all([
    feedService(() => readConfig().config).poll(),
    error ? undefined : databaseHealthService().check(config.sources),
  ]);
  return Response.json({ ...result, database, ...(error ? { error } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}
