import { JarvisMetricCards } from './JarvisMetricCards';
import header from './jarvisHeader.module.css';
import type { FeedPollSummary } from './feedPolling';

export function JarvisMainHeader({feedStatus}:{feedStatus?:FeedPollSummary|null}) {
  return <header className={header.header}>
    <JarvisMetricCards feedStatus={feedStatus} />
  </header>;
}
