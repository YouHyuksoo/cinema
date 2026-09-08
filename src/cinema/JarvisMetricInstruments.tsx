import { jarvisMainData as data, type JarvisMetricKind } from './jarvisMainData';
import { DEFAULT_ENVIRONMENT_DATA, environmentReadingStatus } from './zoneEnvironment';
import { PRODUCT_ZONES, inspectProductMeasurement } from './productInspection';
import styles from './jarvisMetricCards.module.css';

function ProductionInstrument() {
  const ratio = Math.min(1, Math.max(0, data.energy.production.value / data.energy.production.capacity));
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d="M8 46 24 56h140l10-10M8 16h164" className={styles.trace} />
    {Array.from({ length: 20 }, (_, i) => <g key={i} opacity={i / 20 < ratio ? 1 : .12}>
      <path d={`M${10 + i * 8} 29l4-5h5l-4 5z`} fill="currentColor" opacity=".5" />
      <path d={`M${10 + i * 8} 29h5v15h-5z`} fill="currentColor" />
      <path d={`M${15 + i * 8} 29l4-5v15l-4 5z`} fill="currentColor" opacity=".25" />
    </g>)}
    <path d="M8 51h160" className={styles.conveyor} />
    <path d={`M${10 + ratio * 160} 18v30`} stroke="var(--film-ink)" strokeWidth="1" />
    <path d="M12 12h24m-5-3 5 3-5 3" className={styles.flow} />
  </svg>;
}

function ProcessInstrument() {
  const points = data.process.nodes.map((_, i) => ({ x: 14 + i * 30, y: i % 2 ? 43 : 22 }));
  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <polyline points={line} className={styles.trace} />
    <polyline points={line} className={styles.flow} />
    {data.process.nodes.map((node, i) => <g key={node.id} transform={`translate(${points[i].x} ${points[i].y})`} className={data.bottlenecks.includes(node) ? styles.bottleneck : undefined}>
      {data.bottlenecks.includes(node) && <circle r="12" className={styles.warningHalo} />}
      <path d="M-7-4 0-8 7-4v8L0 8-7 4z" fill="var(--film-bg)" stroke="currentColor" />
      <circle r="2.3" fill="currentColor" />
      <text y={i % 2 ? 17 : -12} textAnchor="middle">{node.code}</text>
    </g>)}
  </svg>;
}

function QualityInstrument() {
  const q = data.quality;
  if (!q.valid) return <svg viewBox="0 0 180 64" aria-hidden="true"><text x="90" y="34" textAnchor="middle">NO DATA</text></svg>;
  const values = q.xbar.values;
  const min = Math.min(q.xbar.lower, ...values), max = Math.max(q.xbar.upper, ...values), span = max - min || 1;
  const y = (value: number) => 53 - (value - min) / span * 42;
  const x = (i: number) => 8 + i / Math.max(1, values.length - 1) * 164;
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d={`M8 ${y(q.xbar.lower)}H172M8 ${y(q.xbar.upper)}H172`} className={styles.limits} />
    <path d={`M8 ${y(q.xbar.center)}H172`} className={styles.trace} />
    <polyline points={values.map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
    {values.map((value, i) => q.xbar.violations[i] && <g key={i} transform={`translate(${x(i)} ${y(value)})`} className={styles.bottleneck}>
      <circle r="6" className={styles.warningHalo} /><circle r="2.5" fill="currentColor" />
    </g>)}
    <path d="M0 6v52" className={styles.qualityScan} />
  </svg>;
}

function PowerInstrument() {
  const ratio = Math.min(1, Math.max(0, data.energy.power.value / data.energy.power.capacity));
  const angle = Math.PI * (1 - ratio);
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d="M16 51a42 42 0 0 1 84 0" fill="none" stroke="currentColor" strokeWidth="7" opacity=".12" />
    <path d="M16 51a42 42 0 0 1 84 0" fill="none" stroke="currentColor" strokeWidth="7" pathLength="100" strokeDasharray={`${ratio * 100} 100`} />
    <path d="M10 51a48 48 0 0 1 96 0" className={styles.powerOrbit} />
    <path d={`M58 51L${58 + Math.cos(angle) * 30} ${51 - Math.sin(angle) * 30}`} stroke="var(--film-ink)" strokeWidth="1.6" />
    <circle cx="58" cy="51" r="3" fill="currentColor" />
    <path d="M108 31h13l5-15 10 35 7-20h29" className={styles.trace} />
    <path d="M108 31h13l5-15 10 35 7-20h29" className={styles.powerFlow} />
    <text x="146" y="62" textAnchor="middle">{Math.round(ratio * 100)}% LOAD</text>
  </svg>;
}


function EfficiencyInstrument() {
  const ratio = data.energy.efficiency.value / data.energy.efficiency.capacity;
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <circle cx="45" cy="32" r="23" fill="none" stroke="currentColor" opacity=".15" strokeWidth="5" />
    <circle cx="45" cy="32" r="23" fill="none" stroke="currentColor" strokeWidth="5" pathLength="100"
      strokeDasharray={`${ratio * 100} 100`} transform="rotate(-90 45 32)" />
    <path d="m40 18-7 15h11l-3 13 15-20H45l6-8z" fill="currentColor" opacity=".65" />
    {Array.from({length:8},(_,i)=><path key={i} d={`M${85+i*10} 52V${48-i*5}`} stroke="currentColor" strokeWidth="6" opacity={i / 8 < ratio ? .8 : .15} />)}
  </svg>;
}
function InspectionInstrument() {
  const results = PRODUCT_ZONES.map(zone => { const measurement = data.product.measurements.find(item => item.zone === zone); return measurement ? inspectProductMeasurement(measurement).verdict : 'unavailable'; });
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    {results.map((result, i) => <g key={i} transform={`translate(${30 + i * 60} 30)`}>
      <path d="M-18-14 0-24 18-14v28L0 24-18 14z" fill="none" stroke={result === 'pass' ? 'currentColor' : '#ffc168'} />
      <path d={result === 'pass' ? 'm-8 0 6 6 12-13' : 'm-6-6 12 12m0-12-12 12'} fill="none" stroke={result === 'pass' ? 'currentColor' : '#ffc168'} strokeWidth="2" />
    </g>)}
  </svg>;
}
function EnvironmentInstrument({kind}: {kind:'temperature'|'humidity'}) {
  const zones = DEFAULT_ENVIRONMENT_DATA.zones;
  const readings = zones.map(zone => zone[kind]).filter((value):value is number=>value !== null && Number.isFinite(value));
  if (!readings.length) return <svg viewBox="0 0 180 64" aria-hidden="true"><text x="90" y="32">NO DATA</text></svg>;
  const min=Math.min(...readings), span=Math.max(...readings)-min||1;
  const x=(i:number)=>10+i/Math.max(1,zones.length-1)*160;
  const y=(value:number)=>48-(value-min)/span*32;
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d="M8 52H172M8 32H172M8 12H172" className={styles.trace}/>
    {zones.map((zone,i)=>{const value=zone[kind];if(value===null||!Number.isFinite(value))return null;
      const outside=environmentReadingStatus(value,zone[kind==='temperature'?'temperatureRange':'humidityRange'],kind==='humidity')==='outside';
      return <g key={zone.id} color={outside?'#ffc168':undefined}>
        <path d={`M${x(i)} 52V${y(value)}`} stroke="currentColor" strokeWidth={kind==='humidity'?8:2} opacity=".5"/>
        <circle cx={x(i)} cy={y(value)} r="2.5" fill="currentColor"/>
      </g>;})}
    <text x="90" y="63" textAnchor="middle">ZONE 01 — {String(zones.length).padStart(2,'0')}</text>
  </svg>;
}
const instruments = {production:ProductionInstrument,process:ProcessInstrument,quality:QualityInstrument,power:PowerInstrument,
  efficiency:EfficiencyInstrument,inspection:InspectionInstrument};
export function JarvisMetricInstrument({kind}:{kind:JarvisMetricKind}) {
  if(kind==='temperature'||kind==='humidity') return <EnvironmentInstrument kind={kind}/>;
  const Instrument=instruments[kind];
  return <Instrument/>;
}
