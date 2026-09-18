'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ScreenObjectCatalogEntry, ScreenObjectRegistry } from './screenObjectRegistry';
import { HATCHERY_METRIC_KINDS } from './jarvisMainData';
import styles from './screenObjectInspector.module.css';

const json = (value: unknown) => JSON.stringify(value ?? null, null, 2);
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ScreenObjectInspector({ registry, mainRef, actionError, selectedId, onSelectionChange, onClose, onActionStart, onActionFailure }: {
  registry: ScreenObjectRegistry;
  mainRef: RefObject<HTMLElement | null>;
  actionError?: string;
  selectedId: string;
  onSelectionChange: (id: string) => void;
  onClose: (reason: 'dismiss' | 'action') => void;
  onActionStart: (methodId: string) => void;
  onActionFailure: (message: string) => void;
}) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const revision = useSyncExternalStore(registry.subscribe, registry.getRevision, registry.getRevision);
  const catalog = useMemo(() => registry.catalog().sort((a, b) => {
    const metricIndex = (id: string) => HATCHERY_METRIC_KINDS.indexOf(id.replace('metric.', '') as (typeof HATCHERY_METRIC_KINDS)[number]);
    const aMetric = metricIndex(a.id); const bMetric = metricIndex(b.id);
    if (aMetric >= 0 || bMetric >= 0) return aMetric < 0 ? 1 : bMetric < 0 ? -1 : aMetric - bMetric;
    return a.id.localeCompare(b.id);
  }), [registry, revision]);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreCubeFocus = useRef(true);
  const selected = catalog.find(item => item.id === selectedId) ?? catalog[0];

  useEffect(() => {
    const root = document.createElement('div');
    root.dataset.screenObjectInspectorRoot = 'true';
    document.body.appendChild(root);
    setPortal(root);
    return () => root.remove();
  }, []);

  useEffect(() => {
    if (!portal) return;
    const main = mainRef.current;
    const wasInert = main?.inert ?? false;
    if (main) main.inert = true;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (main) main.inert = wasInert;
      if (restoreCubeFocus.current) requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-cube-control]')?.focus());
    };
  }, [portal, mainRef]);

  const close = (restoreFocus = true, reason: 'dismiss' | 'action' = 'dismiss') => {
    restoreCubeFocus.current = restoreFocus;
    onClose(reason);
  };
  const execute = (object: ScreenObjectCatalogEntry, methodId: string) => {
    onActionStart(methodId);
    close(false, 'action');
    requestAnimationFrame(() => void registry.execute(object.id, methodId).then(result => {
      if (!result.ok) onActionFailure(result.message);
    }));
  };
  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (!items.length) return;
    const first = items[0]; const last = items.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!portal) return null;
  return createPortal(<div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="screen-object-title" onKeyDown={trapFocus}>
      <header className={styles.header}>
        <div><small>LIVE OBJECT REGISTRY</small><h1 id="screen-object-title">실시간 화면 객체 관리</h1></div>
        <div className={styles.live}><i/> {catalog.length} OBJECTS</div>
        <button type="button" className={styles.close} onClick={() => close()} aria-label="실시간 화면 객체 관리 닫기">×</button>
      </header>
      <div className={styles.layout}>
        <nav className={styles.objects} aria-label="등록된 화면 객체">
          {catalog.length ? catalog.map(object => <button type="button" key={object.id} data-selected={object.id === selected?.id}
            onClick={() => onSelectionChange(object.id)}><strong>{object.id}</strong><span>{object.description}</span><em>{object.bindings.length ? `${object.bindings.length} FEED` : `${object.methods.length} METHOD`}</em></button>)
            : <p>현재 등록된 화면 객체가 없습니다.</p>}
        </nav>
        <section className={styles.detail} aria-live="polite">
          {actionError && <p className={styles.actionError} role="alert">실행 실패 · {actionError}</p>}
          {selected ? <>
            <div className={styles.identity}><div><small>OBJECT ID</small><h2>{selected.id}</h2><p>{selected.description}</p></div>
              <span data-bound={selected.bindings.length > 0}>{selected.bindings.length ? 'DATA BOUND' : 'CONTROL'}</span></div>
            <div className={styles.actions}>
              {selected.methods.map(method => {
                const runnable = (method.id === 'focus' || method.id === 'openDetail') && !method.parameters;
                return <div key={method.id}><code>{method.id}()</code><span>{method.description}</span>
                  {runnable && <button type="button" onClick={() => execute(selected, method.id)}>{method.id === 'focus' ? '중앙 확대' : '상세 화면 열기'}</button>}</div>;
              })}
            </div>
            <div className={styles.columns}>
              <section><h3>CURRENT STATE</h3><pre>{json(selected.state)}</pre></section>
              <section><h3>DATA BINDINGS</h3>{selected.bindings.length ? selected.bindings.map(binding => <article key={`${binding.feedId}-${binding.sceneKey}`}>
                <dl><dt>피드</dt><dd>{binding.feedId}</dd><dt>장면 키</dt><dd>{binding.sceneKey}</dd><dt>접근</dt><dd>읽기 전용</dd>
                  <dt>상태</dt><dd data-ok={binding.feedStatus?.ok}>{binding.feedStatus ? `${binding.feedStatus.mode} · ${binding.feedStatus.ok ? '정상' : '확인 필요'}` : '시연 데이터'}</dd>
                  <dt>출처</dt><dd>{binding.provenance ? `${binding.provenance.source} · ${binding.provenance.at}` : '기본 시연값'}</dd></dl>
                {binding.feedStatus?.error && <p className={styles.error}>{binding.feedStatus.error}</p>}
                <details><summary>사용 필드</summary><pre>{binding.snapshotFields.join('\n')}</pre></details>
                <details open><summary>현재 스냅샷</summary><pre>{json(binding.snapshot)}</pre></details>
                {binding.feedSchema && <details><summary>수신 JSON Schema</summary><pre>{json(binding.feedSchema)}</pre></details>}
              </article>) : <p className={styles.empty}>이 객체는 화면 제어만 제공하며 데이터 피드를 읽지 않습니다.</p>}</section>
            </div>
          </> : <p className={styles.empty}>표시할 객체가 없습니다.</p>}
        </section>
      </div>
    </div>
  </div>, portal);
}
