'use client';

import type { RefObject } from 'react';
import { environmentCanvasPoint } from './environmentSceneObjects';
import { isEnvironmentPortrait } from './environmentMobileLayout';
import type { EnvironmentSelectionController } from './useEnvironmentSelection';
import styles from './environmentInteraction.module.css';

export function EnvironmentZoneInteraction({ canvas, controller }: {
  canvas: RefObject<HTMLCanvasElement | null>; controller: EnvironmentSelectionController;
}) {
  return <>
    <div className={styles.surface} role="group" tabIndex={0}
      aria-label="온습도 ZONE 선택 영역" aria-describedby="environment-selection-help"
      onClick={event => {
        const node = canvas.current;
        if (!node) return;
        event.currentTarget.focus();
        const rect = node.getBoundingClientRect();
        const dock = Number.parseFloat(getComputedStyle(node).getPropertyValue('--film-dock-space')) || 0;
        controller.pick(environmentCanvasPoint({ left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          pixelWidth: node.width, pixelHeight: node.height, bottomInset: dock * node.height / Math.max(1, rect.height) },
        { x: event.clientX, y: event.clientY }), isEnvironmentPortrait(node.width, node.height));
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); controller.clear(); }
        else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); controller.step(['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1);
        }
      }} />
    <div className={styles.status}>
      <span role="status" aria-live="polite" aria-atomic="true" data-selected-zone={controller.selectedId ?? ''}>
        {controller.selectedId ? `${controller.selectedId} 선택 중` : '자동 순회'}
      </span>
      <span id="environment-selection-help">카드 클릭·방향키 선택 / 빈 곳 클릭·Esc 해제 / 하단에서 재생·정지</span>
    </div>
  </>;
}
