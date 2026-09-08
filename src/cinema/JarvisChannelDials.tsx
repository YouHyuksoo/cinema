import { JarvisMiniDial } from './JarvisHoloGauge';
import { jarvisMainData as data } from './jarvisMainData';
import styles from './jarvisStream.module.css';

export function JarvisChannelDials() {
  const { energy, process, bottlenecks, quality, qualitySource, inspection } = data;
  const production = energy.production.value / energy.production.capacity;
  const power = energy.power.value / energy.power.capacity;
  const controlled = quality.valid ? qualitySource.subgroups.length - quality.violationCount : 0;
  return <div className={styles.channelDials} aria-label="현장 보조 게이지">
    <JarvisMiniDial label="생산 달성" value={`${(production * 100).toFixed(1)}%`} ratio={production} />
    <JarvisMiniDial variant="sectors" label="공정 여력" value={`${process.nodes.length - bottlenecks.length}/${process.nodes.length}`} ratio={1 - bottlenecks.length / process.nodes.length} warning={bottlenecks.length > 0} />
    <JarvisMiniDial variant="vernier" label="SPC 범위 내" value={quality.valid ? `${controlled}/${qualitySource.subgroups.length}` : '—'} ratio={controlled / qualitySource.subgroups.length} warning={quality.valid && quality.outOfControl} />
    <JarvisMiniDial variant="double" label="전력 사용" value={`${Math.round(power * 100)}%`} ratio={power} />
    <JarvisMiniDial variant="blocks" label="검사 합격" value={`${inspection.passed}/${inspection.total}`} ratio={inspection.passed / inspection.total} warning={inspection.failed > 0} />
  </div>;
}
