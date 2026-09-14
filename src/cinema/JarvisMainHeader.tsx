import { JarvisMetricCards } from './JarvisMetricCards';
import header from './jarvisHeader.module.css';
import type { FeedPollSummary } from './feedPolling';
import type { FilmSceneData } from './filmSceneData';
import type { FilmSceneDataKey } from './filmSceneData';
import type { SceneDataProvenance } from './sceneDataStore';
import type { JarvisStreamFocusRequest } from './JarvisStream';
import type { FilmId } from './filmProgram';

export function JarvisMainHeader({data,feedStatus,provenance,onFocusMetric,onChapter}:{data?:FilmSceneData;feedStatus?:FeedPollSummary|null;
  provenance?:(key:FilmSceneDataKey)=>SceneDataProvenance|undefined; onFocusMetric?:(request:JarvisStreamFocusRequest)=>void; onChapter?:(id:FilmId)=>void}) {
  return <header className={header.header}>
    <JarvisMetricCards data={data} feedStatus={feedStatus} provenance={provenance} onFocusMetric={onFocusMetric} onChapter={onChapter}/>
  </header>;
}
