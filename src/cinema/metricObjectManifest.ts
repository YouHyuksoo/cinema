import { domainFeed, feedJsonSchema } from './domainFeeds';
import type { FeedPollSummary } from './feedPolling';
import type { FilmSceneDataKey } from './filmSceneData';
import type { FilmId } from './filmProgram';
import type { HatcheryMetricKind } from './jarvisMainData';
import type { ScreenObjectFeedStatus } from './screenObjectRegistry';

export interface MetricObjectDefinition {
  id: `metric.${HatcheryMetricKind}`;
  feedId: string;
  sceneKey: FilmSceneDataKey;
  detailChapter: FilmId;
  snapshotFields: readonly string[];
  feedSchema?: Record<string, unknown>;
}

const definition = (
  kind: HatcheryMetricKind,
  feedId: string,
  sceneKey: FilmSceneDataKey,
  detailChapter: FilmId,
  snapshotFields: readonly string[],
): MetricObjectDefinition => {
  const feed = domainFeed(feedId);
  return { id: `metric.${kind}`, feedId, sceneKey, detailChapter, snapshotFields,
    feedSchema: feed ? feedJsonSchema(feed) : undefined };
};

export const METRIC_OBJECT_MANIFEST: Record<HatcheryMetricKind, MetricObjectDefinition> = {
  production: definition('production', 'energy', 'energy', 'energy', ['production.value', 'production.capacity', 'production.unit']),
  process: definition('process', 'process', 'network', 'network', ['demandPerHour', 'nodes[].capacityPerHour', 'nodes[].queue', 'nodes[].cycleSeconds']),
  quality: definition('quality', 'quality', 'spc', 'spc', ['subgroups[].values', 'lsl', 'usl']),
  power: definition('power', 'energy', 'energy', 'energy', ['power.value', 'power.capacity', 'power.unit']),
  efficiency: definition('efficiency', 'energy', 'energy', 'energy', ['efficiency.value', 'efficiency.capacity']),
  inspection: definition('inspection', 'inspection', 'product', 'product', ['measurements[].actual', 'measurements[].nominal', 'measurements[].tolerance', 'measurements[].unit']),
  temperature: definition('temperature', 'environment', 'environment', 'wave', ['zones[].temperature', 'tempRange']),
  humidity: definition('humidity', 'environment', 'environment', 'wave', ['zones[].humidity', 'humidityRange']),
};

export function metricFeedStatus(feedId: string, summary?: FeedPollSummary | null): ScreenObjectFeedStatus | undefined {
  if (!summary) return undefined;
  if (summary.mode === 'static') return { mode:'static', ok:true, at:summary.at, issues:[] };
  if (summary.mode === 'error') return { mode:'error', ok:false, at:summary.at, error:summary.error, issues:summary.rejected };
  const feed = summary.feeds.find(item => item.feed === feedId);
  if (!feed) return { mode:'server', ok:false, at:summary.at, error:'이 피드의 실행 상태가 없습니다.', issues:summary.rejected };
  return { mode:'server', ok:feed.ok, at:feed.at ?? summary.at, error:feed.error ?? summary.error,
    issues:[...feed.issues, ...summary.rejected] };
}
