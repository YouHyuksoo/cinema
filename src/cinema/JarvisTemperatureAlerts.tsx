import { environmentReadingStatus, type EnvironmentZone } from './zoneEnvironment';
import styles from './jarvis.module.css';

export function JarvisTemperatureAlerts({ zones, onDetails }: {
  zones: readonly EnvironmentZone[]; onDetails: () => void;
}) {
  const outside = zones.filter(zone => environmentReadingStatus(zone.temperature, zone.temperatureRange) === 'outside');
  const missing = zones.filter(zone => environmentReadingStatus(zone.temperature, zone.temperatureRange) === 'missing');
  return <section className={styles.right} aria-label="온도 이탈 알림">
    <div className={styles.sectionTitle}>ATTENTION / TEMPERATURE</div>
    <div className={styles.alertSummary}><span>온도 범위 이탈</span><b>{outside.length}곳</b></div>
    {outside.map(zone => {
      const temperature = zone.temperature!;
      const high = temperature > zone.temperatureRange.max;
      const difference = high ? temperature - zone.temperatureRange.max : zone.temperatureRange.min - temperature;
      return <article className={styles.temperatureAlert} key={zone.id} aria-label={`${zone.id} 온도 ${high ? '상한 초과' : '하한 미달'}`}>
        <div><b>{zone.id}</b><span>{zone.name}</span></div>
        <strong>{temperature.toFixed(1)}<small>°C</small></strong>
        <p>{high ? '상한 초과' : '하한 미달'} · {difference.toFixed(1)}°C</p>
        <small>관리 범위 {zone.temperatureRange.min}–{zone.temperatureRange.max}°C</small>
      </article>;
    })}
    {!outside.length && <p className={styles.quietStatus}>{!zones.length ? '온도 데이터 대기 중' : missing.length ? '확인된 온도 중 범위 이탈 없음' : '모든 구역의 온도가 관리 범위 내입니다.'}</p>}
    {missing.length > 0 && <p className={styles.notice}>온도 미확인 {missing.length}곳 · 데이터 확인 필요</p>}
    <button type="button" onClick={onDetails}>온습도 상세 보기 ↗</button>
    <p className={styles.notice}>시연 데이터 / 실제 MES 미연결</p>
  </section>;
}
