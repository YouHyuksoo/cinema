import { SMT_FACTORY_LINES, SMT_FACTORY_STATIONS } from './smtFactory';
import { SMT_LINE } from './smtLine';
import styles from './smtInteraction.module.css';
import { pad2 } from './filmMath';

export interface SmtFactoryControlsProps {
  manual: boolean;
  selectedKey: string | null;
  onExplore: () => void;
  onAuto: () => void;
  onReset: () => void;
  onSelect: (key: string) => void;
  onFocus: () => void;
  onZoom: (delta: number) => void;
}

const lines = Array.from({ length: SMT_FACTORY_LINES }, (_, index) => ({
  label: `라인 ${pad2(index + 1)}`,
  stations: SMT_FACTORY_STATIONS.filter(station => station.line === index + 1),
}));

export function SmtFactoryControls({
  manual, selectedKey, onExplore, onAuto, onReset, onSelect, onFocus, onZoom,
}: SmtFactoryControlsProps) {
  const selected = SMT_FACTORY_STATIONS.find(station => station.key === selectedKey);

  return (
    <section className={styles.toolbar} aria-label="3D 설비 탐색">
      {manual ? (
        <>
          <div className={styles.heading}>
            <span className={styles.status}><span className={styles.statusLight} />직접 탐색 중</span>
            <span className={styles.lineCount}>{SMT_FACTORY_LINES} LINES</span>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={onAuto}>자동 투어</button>
            <button type="button" className={styles.button} onClick={onReset}>입구 시점</button>
          </div>
          <select
            className={styles.select}
            aria-label="설비 선택"
            value={selected?.key ?? ''}
            onChange={event => {
              if (event.target.value) onSelect(event.target.value);
            }}
          >
            <option value="" disabled>화면에서 설비를 선택하세요</option>
            {lines.map(line => (
              <optgroup key={line.label} label={line.label}>
                {line.stations.map(station => (
                  <option key={station.key} value={station.key}>
                    {pad2(station.order)} · {station.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className={styles.selection} aria-live="polite" aria-atomic="true">
            {selected ? (
              <>
                <span className={styles.selectionName}>
                  라인 {pad2(selected.line)} · {selected.label}
                </span>
                <span className={styles.selectionDetail}>
                  {selected.order}/{SMT_LINE.length} · {selected.english}
                </span>
              </>
            ) : <span className={styles.selectionDetail}>설비를 클릭하거나 목록에서 선택하세요.</span>}
          </div>
          <div className={styles.navigation}>
            <button type="button" className={`${styles.button} ${styles.focusButton}`} disabled={!selected} onClick={onFocus}>
              선택 설비로 이동
            </button>
            <button type="button" className={`${styles.button} ${styles.zoomButton}`} aria-label="축소" onClick={() => onZoom(120)}>−</button>
            <button type="button" className={`${styles.button} ${styles.zoomButton}`} aria-label="확대" onClick={() => onZoom(-120)}>+</button>
          </div>
        </>
      ) : (
        <button type="button" className={`${styles.button} ${styles.exploreButton}`} onClick={onExplore}>직접 탐색</button>
      )}
      <p id="smt-explore-help" className={styles.hint}>드래그 회전 · 휠 확대 · 클릭 선택<br />Shift + 드래그 이동 · 방향키 회전</p>
    </section>
  );
}
