import { describe, expect, it } from 'vitest';
import { HATCHERY_METRIC_KINDS } from '@/cinema/jarvisMainData';
import { METRIC_OBJECT_MANIFEST, metricFeedStatus } from '@/cinema/metricObjectManifest';

describe('metric object manifest', () => {
  it('maps every top metric to a read contract and detail scene', () => {
    expect(Object.keys(METRIC_OBJECT_MANIFEST)).toEqual([...HATCHERY_METRIC_KINDS]);
    for (const kind of HATCHERY_METRIC_KINDS) {
      const object = METRIC_OBJECT_MANIFEST[kind];
      expect(object.id).toBe(`metric.${kind}`);
      expect(object.snapshotFields.length).toBeGreaterThan(0);
      expect(object.feedSchema).toMatchObject({type:'object'});
    }
    expect(METRIC_OBJECT_MANIFEST.production).toMatchObject({feedId:'energy',sceneKey:'energy',detailChapter:'energy'});
    expect(METRIC_OBJECT_MANIFEST.temperature).toMatchObject({feedId:'environment',sceneKey:'environment',detailChapter:'wave'});
  });

  it('selects the matching feed health without exposing data mutation', () => {
    const status = metricFeedStatus('energy', {mode:'server',at:'now',applied:1,rejected:[],feeds:[
      {feed:'energy',enabled:true,ok:true,at:'feed-time',issues:[],counts:{}},
    ]});
    expect(status).toEqual({mode:'server',ok:true,at:'feed-time',error:undefined,issues:[]});
  });
});
