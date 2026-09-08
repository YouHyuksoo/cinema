import { describe, expect, it } from 'vitest';
import { drawInspectionField } from '@/cinema/components/drawInspectionField';
import { DEFAULT_FONTS, signalColor } from '@/cinema/filmDrawing';
import {
  INSPECTION_STATIONS, inspectionFocusPoint, inspectionStation, projectInspectionPoint, type InspectionCamera,
} from '@/cinema/inspectionSpace';

type Point = { x: number; y: number };
const CAMERA: InspectionCamera = { x: 0, y: 210, z: -1500, yaw: -Math.PI / 8, pitch: .1, focal: 720, near: 35 };

function renderField(focus: number, selectedId?: number) {
  let matrix = [1, 0, 0, 1, 0, 0], path: Point[] = [];
  const stack: { matrix: number[]; alpha: number; fill: string; stroke: string }[] = [];
  const labels: (Point & { text: string; color: string })[] = [];
  const strokes: { points: Point[]; color: string }[] = [];
  const fills: { points: Point[]; color: string }[] = [];
  const point = (x: number, y: number): Point => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  });
  const drawing = {
    globalAlpha: 1, fillStyle: '', strokeStyle: '',
    save() { stack.push({ matrix: [...matrix], alpha: this.globalAlpha, fill: this.fillStyle, stroke: this.strokeStyle }); },
    restore() {
      const state = stack.pop();
      if (!state) throw new Error('Unbalanced restore');
      matrix = state.matrix; this.globalAlpha = state.alpha; this.fillStyle = state.fill; this.strokeStyle = state.stroke;
    },
    transform(a: number, b: number, c: number, d: number, e: number, f: number) {
      const m = matrix;
      matrix = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d,
        m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    },
    beginPath() { path = []; }, closePath() {}, fillRect() {},
    moveTo(x: number, y: number) { path.push(point(x, y)); },
    lineTo(x: number, y: number) { path.push(point(x, y)); },
    stroke() { strokes.push({ points: [...path], color: this.strokeStyle }); },
    fill() { fills.push({ points: [...path], color: this.fillStyle }); },
    fillText(text: string, x: number, y: number) { labels.push({ ...point(x, y), text, color: this.fillStyle }); },
  };
  drawInspectionField(drawing as unknown as CanvasRenderingContext2D, DEFAULT_FONTS, CAMERA, 10, focus, 1, selectedId);
  expect(stack).toHaveLength(0);
  return { labels: labels.filter(label => label.text.startsWith('SMT /')), strokes, fills };
}

function expectPoint(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
}

describe('inspection field selection', () => {
  it.each([3, 4, 1])('moves only selected station %s and keeps its thermal mark and shadow attached', selectedId => {
    const frame = renderField(1, selectedId);
    expect(frame.labels).toHaveLength(4);
    for (const station of INSPECTION_STATIONS) {
      const selected = station.id === selectedId;
      const label = frame.labels.find(item => item.text === `SMT / 0${station.id}`)!;
      const origin = { x: station.x - 49, y: 144, z: station.z - 76 };
      expectPoint(label, projectInspectionPoint(CAMERA, inspectionFocusPoint(origin, selected ? 1 : 0)));
      expect(label.color).toBe(signalColor(selected ? 1 : 0, 1));
    }
    const station = inspectionStation(selectedId);
    const thermalRing = frame.strokes.find(stroke => stroke.color === signalColor(1, .75));
    expect(thermalRing).toBeDefined();
    expectPoint(thermalRing!.points[0], projectInspectionPoint(CAMERA,
      inspectionFocusPoint({ x: station.x + 39, y: 88, z: station.z - 76.5 }, 1)));
    const shadow = frame.fills.filter(fill => fill.color.startsWith('rgba(0,3,7,'))[selectedId - 1];
    expectPoint(shadow.points[0], projectInspectionPoint(CAMERA, { x: station.x + 128, y: 1, z: station.z - 62 }));
  });

  it('reorders the advancing station when its depth passes another cabinet', () => {
    expect(renderField(0, 1).labels.map(label => label.text)).toEqual(['SMT / 01', 'SMT / 02', 'SMT / 03', 'SMT / 04']);
    expect(renderField(1, 1).labels.map(label => label.text)).toEqual(['SMT / 02', 'SMT / 01', 'SMT / 03', 'SMT / 04']);
  });

  it('preserves the legacy selection for omitted and unknown IDs', () => {
    expect(renderField(1)).toEqual(renderField(1, 3));
    expect(renderField(1, 99)).toEqual(renderField(1, 3));
  });
});
