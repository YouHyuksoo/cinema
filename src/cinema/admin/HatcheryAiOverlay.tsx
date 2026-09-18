'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { HatcheryAiSettings } from './HatcheryAiSettings';
import { HatcheryAdmin } from './HatcheryAdmin';
import styles from './hatcheryAiOverlay.module.css';

export function HatcheryAiOverlay({ mainRef, onClose, initialPage = 'ai', initialSection }: {
  mainRef: RefObject<HTMLElement | null>; onClose: () => void; initialPage?: 'ai' | 'admin'; initialSection?: 'voice';
}) {
  const [page, setPage] = useState(initialPage);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const portal = document.createElement('div');
    portal.dataset.hatcheryAiOverlayRoot = 'true';
    document.body.appendChild(portal); setRoot(portal);
    return () => portal.remove();
  }, []);
  useEffect(() => {
    if (!root) return;
    const main = mainRef.current; const wasInert = main?.inert ?? false;
    if (main) main.inert = true;
    return () => {
      if (main) main.inert = wasInert;
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-cube-control]')?.focus());
    };
  }, [mainRef, root]);
  if (!root) return null;
  return createPortal(<div className={styles.overlay} role="dialog" aria-modal="true" aria-label={page === 'ai' ? 'HATCHERY AI 설정' : 'HATCHERY 데이터 소스 관리'}>
    <button type="button" className={styles.close} aria-label="관리 설정 닫기" onClick={onClose}>×</button>
    {page === 'ai' ? <HatcheryAiSettings onClose={onClose} onOpenAdmin={() => setPage('admin')} initialSection={initialSection}/>
      : <HatcheryAdmin onClose={onClose} onOpenAi={() => setPage('ai')}/>}
  </div>, root);
}
