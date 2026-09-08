import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import type { PcbInspectionState } from '../pcbInspection';
import { PCB_DEFECT_LABELS, PCB_INSPECTION_PROCESS_LABELS } from '../pcbInspectionData';
import type { PcbInspectionLayout } from '../pcbInspectionLayout';

const DEFECT_SHAPE_NOTE = {
  insufficient_solder: '시연 형상 · 패드 접합부의 소량 납',
  offset: '시연 형상 · 기준 패드와 부품의 어긋남',
  bridge: '시연 형상 · 인접 단자 사이 연결 납',
} as const;

function fittedLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const words = [...value], lines: string[] = [];
  let line = '';
  for (const character of words) {
    const next = line + character;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = character; }
    else line = next;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join('').length;
  if (consumed < value.length && lines.length) {
    const last = lines.length - 1;
    while (lines[last] && ctx.measureText(`${lines[last]}…`).width > maxWidth) lines[last] = lines[last].slice(0, -1);
    lines[last] += '…';
  }
  return lines;
}

function panel(ctx: CanvasRenderingContext2D, layout: PcbInspectionLayout, opacity: number) {
  const { x, y, width, height } = layout.readout;
  ctx.save(); ctx.globalAlpha = opacity;
  const glow = ctx.createLinearGradient(x, y, x + width, y + height);
  glow.addColorStop(0, 'rgba(10,31,38,.92)'); glow.addColorStop(1, 'rgba(3,12,17,.84)');
  ctx.fillStyle = glow; ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = signalColor(0, .34); ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = signalColor(0, .72); ctx.fillRect(x, y, Math.min(76, width * .24), 2);
  ctx.restore();
}

function multiline(ctx: CanvasRenderingContext2D, fonts: FilmFonts, value: string,
  x: number, y: number, width: number, size: number, opacity: number, maxLines = 2, mono = false) {
  ctx.save(); ctx.font = `${size}px ${mono ? fonts.mono : fonts.label}`;
  const lines = fittedLines(ctx, value, width, maxLines); ctx.restore();
  lines.forEach((line, index) => filmText(ctx, fonts, line, x, y + index * (size + 4), size, opacity, mono));
  return Math.max(1, lines.length) * (size + 4);
}

/** Responsive readout copy; every result is derived from the same validated component array as the tour. */
export function drawPcbInspectionReadout(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  layout: PcbInspectionLayout, state: PcbInspectionState) {
  const opacity = state.presence, { x, y, width, height } = layout.readout;
  panel(ctx, layout, opacity);
  const pad = layout.portrait ? 14 : 20, left = x + pad, maxWidth = width - pad * 2;
  const bodySize = layout.portrait ? 14 : 13, titleSize = layout.portrait ? 15 : 13;
  let cursor = y + pad + titleSize;
  filmText(ctx, fonts, state.phase === 'summary' || state.phase === 'fade' ? 'INSPECTION SUMMARY' : 'COMPONENT READOUT',
    left, cursor, titleSize, opacity * .72, true);
  cursor += layout.portrait ? 25 : 31;

  if (!state.validation.valid) {
    filmText(ctx, fonts, '데이터 오류', left, cursor, bodySize + 3, opacity, false, 'left', signalColor(1, 1));
    cursor += bodySize + 10;
    multiline(ctx, fonts, state.validation.reason, left, cursor, maxWidth, bodySize, opacity * .78, 3);
    return;
  }
  if (!state.counts.total) {
    filmText(ctx, fonts, '검사 대상 없음', left, cursor, bodySize + 3, opacity, false, 'left', '#d7edf0');
    filmText(ctx, fonts, '부품 문서가 비어 있습니다.', left, cursor + bodySize + 26, bodySize, opacity * .62);
    return;
  }

  const selected = state.selectedComponent;
  if (selected) {
    const compact = height < 210;
    filmText(ctx, fonts, selected.id, left, cursor, layout.portrait ? 22 : 25, opacity, true, 'left', signalColor(1, 1));
    cursor += layout.portrait ? 27 : 34;
    cursor += multiline(ctx, fonts, selected.label, left, cursor, maxWidth, bodySize + 1, opacity * .95, compact ? 1 : 2);
    cursor += 3;
    cursor += multiline(ctx, fonts, selected.partNumber, left, cursor, maxWidth, bodySize, opacity * .72, compact ? 1 : 2, true);
    cursor += 5;
    filmText(ctx, fonts, `불량  ${PCB_DEFECT_LABELS[selected.defect]}`, left, cursor, bodySize, opacity, false, 'left', signalColor(1, 1));
    cursor += bodySize + 8;
    filmText(ctx, fonts, `검사 공정  ${PCB_INSPECTION_PROCESS_LABELS[selected.process]}`, left, cursor, bodySize, opacity * .9, true);
    cursor += bodySize + 8;
    if (selected.defect in DEFECT_SHAPE_NOTE && cursor < y + height - bodySize) {
      multiline(ctx, fonts, DEFECT_SHAPE_NOTE[selected.defect as keyof typeof DEFECT_SHAPE_NOTE], left, cursor, maxWidth,
        Math.max(12, bodySize - 1), opacity * .64, compact ? 1 : 2);
    }
    return;
  }

  const { total, pass, fail, uninspected } = state.counts;
  if (state.phase === 'scan') {
    filmText(ctx, fonts, `표면 스캔  ${Math.round(state.scan * 100)}%`, left, cursor, bodySize + 2, opacity * .92, true);
    filmText(ctx, fonts, `검사 대상 ${total}`, left, cursor + bodySize + 28, bodySize, opacity * .65);
    return;
  }
  filmText(ctx, fonts, `전체 ${total}  ·  정상 ${pass}`, left, cursor, bodySize + 1, opacity * .92, true);
  cursor += bodySize + 10;
  filmText(ctx, fonts, `불량 ${fail}  ·  미검사 ${uninspected}`, left, cursor, bodySize + 1, opacity, true,
    'left', signalColor(fail ? 1 : 0, 1));
  cursor += bodySize + 15;
  if (!fail) {
    filmText(ctx, fonts, '검사 불량 없음', left, cursor, bodySize + 2, opacity * .9);
    return;
  }
  const rowHeight = bodySize + 7;
  const availableRows = Math.max(0, Math.floor((y + height - pad - cursor) / rowHeight));
  const needsOverflow = state.failedComponents.length > availableRows;
  const visibleCount = Math.min(state.failedComponents.length, needsOverflow ? Math.max(0, availableRows - 1) : availableRows);
  state.failedComponents.slice(0, visibleCount).forEach((component, index) => {
    const value = `${component.id}  ${PCB_DEFECT_LABELS[component.defect]} / ${PCB_INSPECTION_PROCESS_LABELS[component.process]}`;
    multiline(ctx, fonts, value, left, cursor + index * rowHeight, maxWidth, bodySize, opacity * .78, 1, true);
  });
  const hidden = state.failedComponents.length - visibleCount;
  if (hidden > 0 && availableRows > 0) filmText(ctx, fonts, `외 ${hidden}개`, left, cursor + visibleCount * rowHeight, bodySize, opacity * .65, true);
}
