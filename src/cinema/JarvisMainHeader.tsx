import { JarvisMetricCards } from './JarvisMetricCards';
import header from './jarvisHeader.module.css';

export function JarvisMainHeader() {
  return <header className={header.header}>
    <JarvisMetricCards />
  </header>;
}
