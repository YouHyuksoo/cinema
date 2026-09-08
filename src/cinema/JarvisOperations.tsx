import { jarvisMainData as data } from './jarvisMainData';
import { processCapacity } from './processNetwork';
import type { FilmId } from './filmProgram';
import styles from './jarvisStream.module.css';
import { JarvisHoloGauge } from './JarvisHoloGauge';

function Segments({ fill }: { fill: number }) {
  return <div className={styles.bar} aria-hidden="true">{Array.from({ length: 24 }, (_, i) =>
    <i key={i} style={{ opacity: i / 24 < fill ? .8 : .12 }} />)}</div>;
}
export function JarvisOperations({ onChapter }: { onChapter: (id: FilmId) => void }) {
  const { production } = data.energy;
  return <>
    <section className={styles.block}>
      <h2>PRODUCTION / 생산 진행</h2>
      <JarvisHoloGauge value={production.value.toLocaleString('en-US')} unit={production.unit}
        ratio={production.value / production.capacity} label="OUTPUT / 생산 진행" />
      <div className={styles.row}><span>목표</span><b>{production.capacity.toLocaleString('en-US')} EA</b></div>
      <div className={styles.row}><span>달성률</span><b>{(production.value / production.capacity * 100).toFixed(1)}%</b></div>
      <button onClick={() => onChapter('energy')}>생산·에너지 연출 ↗</button>
    </section>
    <section className={styles.block}>
      <h2>PROCESS / 공정 흐름</h2>
      <small>시간당 요구량 {data.process.demandPerHour} EA</small>
      <div className={styles.channels}>{data.process.nodes.map(node => {
        const capacity = processCapacity(node);
        return <div className={styles.channel} key={node.id} data-warning={data.bottlenecks.includes(node)}>
          <span>{node.code}</span><div className={styles.channelBars} aria-hidden="true">{Array.from({ length: 22 }, (_, n) =>
            <i key={n} style={{ opacity: n / 22 < capacity / 700 ? .9 : .1 }} />)}</div>
          <b>{Math.round(capacity)}</b><small>{node.label}</small>
        </div>;
      })}</div>
      <small>처리능력 EA/h · 앰버 표시는 병목</small>
      <button onClick={() => onChapter('network')}>공정망 살펴보기 ↗</button>
    </section>
    <section className={styles.block}>
      <h2>QUEUE / 병목 대기</h2>
      <svg viewBox="0 0 240 80" className={styles.queueFlow} aria-hidden="true">
        <path d="M8 40h72l20-20h40l20 20h72M8 50h62l20 20h60l20-20h62" fill="none" stroke="currentColor" opacity=".4" />
        {[20, 45, 70, 104, 119, 134, 168, 195, 220].map((x, i) => <circle key={x} cx={x} cy={i > 2 && i < 6 ? 20 : 40} r={i > 2 && i < 6 ? 5 : 2} fill="currentColor" />)}
        <circle cx="120" cy="40" r="29" stroke="currentColor" strokeDasharray="4 6" fill="none" />
      </svg>
      {data.bottlenecks.map(node => <div key={node.id}><div className={styles.row} data-warning><span>{node.label}</span><b>{node.queue} EA 대기</b></div>
        <p>사이클 {node.cycleSeconds}초 · 요구량 대비 처리능력 부족</p></div>)}
    </section>
  </>;
}
export function JarvisQualityEnergy({ onChapter }: { onChapter: (id: FilmId) => void }) {
  const { quality, energy, inspection, product } = data;
  const means = quality.valid ? quality.xbar.values : [];
  const min = Math.min(...means), span = Math.max(...means) - min || 1;
  return <>
    <section className={styles.block}>
      <h2>QUALITY / 공정 품질</h2>
      <small>{data.qualitySource.name}</small>
      {quality.valid ? <>
        <svg className={styles.spark} viewBox="0 0 200 65" role="img" aria-label="부분군별 평균 측정값 추이">
          <path d="M0 55h200M0 60h200M0 6v49m50-49v49m50-49v49m50-49v49m50-49v49" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".15" />
          <polygon points={`0,55 ${means.map((value, i) => `${i / (means.length - 1) * 200},${48 - (value - min) / span * 40}`).join(' ')} 200,55`} fill="currentColor" opacity=".08" />
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={means.map((value, i) => `${i / (means.length - 1) * 200},${48 - (value - min) / span * 40}`).join(' ')} />
          {means.map((value, i) => <circle key={i} cx={i / (means.length - 1) * 200} cy={48 - (value - min) / span * 40} r={quality.xbar.violations[i] ? 3 : 1.2} fill={quality.xbar.violations[i] ? '#ffc168' : 'currentColor'} />)}
        </svg>
        <div className={styles.row} data-warning={quality.outOfControl}><span>관리 한계 이탈</span><b>{quality.violationCount} 부분군</b></div>
        <div className={styles.row}><span>Cpk {quality.outOfControl ? '(참고)' : ''}</span><b>{quality.cpk?.toFixed(2) ?? '—'}</b></div>
        {quality.outOfControl && <p>공정 안정성 확인 필요 · 능력 판정 보류</p>}
      </> : <p>품질 데이터 확인 필요</p>}
      <button onClick={() => onChapter('spc')}>SPC 분석 보기 ↗</button>
    </section>
    <section className={styles.block}>
      <h2>ENERGY / 전력·효율</h2>
      <JarvisHoloGauge value={String(energy.power.value)} unit={energy.power.unit}
        ratio={energy.power.value / energy.power.capacity} label="POWER / 사용 전력" />
      <Segments fill={energy.power.value / energy.power.capacity} />
      <div className={styles.row}><span>용량</span><b>{energy.power.capacity} kW</b></div>
      <div className={styles.row}><span>효율</span><b>{energy.efficiency.value}%</b></div>
      <button onClick={() => onChapter('energy')}>에너지 파동 보기 ↗</button>
    </section>
    <section className={styles.block}>
      <h2>INSPECTION / 제품 검사</h2><small>{product.name} · {product.serial}</small>
      <svg viewBox="0 0 240 104" className={styles.inspectionScan} aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth=".8">
          <path d="M25 48 64 29h112l39 19v31l-39 18H64L25 79ZM25 48h190M64 29v68m112-68v68" opacity=".35" />
          <ellipse cx="92" cy="61" rx="26" ry="32" /><ellipse cx="153" cy="61" rx="26" ry="32" />
          <path d="M92 29h61M92 93h61M92 50h61m-61 22h61M46 56h156v10H46Z" />
          <ellipse cx="92" cy="61" rx="9" ry="13" /><ellipse cx="153" cy="61" rx="9" ry="13" />
        </g>
        <g fill="none" stroke="#e4aeaa"><circle cx="153" cy="61" r="22" strokeDasharray="3 5" />
          <path d="M153 36V17h46M199 14v6" strokeWidth=".7" /></g>
        <text x="235" y="16" textAnchor="end" className={styles.gaugeCaption}>TOL / CHECK</text>
      </svg>
      <div className={styles.row}><span>합격</span><b>{inspection.passed} 항목</b></div>
      <div className={styles.row} data-warning={inspection.failed > 0}><span>허용차 이탈</span><b>{inspection.failed} 항목</b></div>
      <button onClick={() => onChapter('product')}>검사 부위 확인 ↗</button>
    </section>
  </>;
}
