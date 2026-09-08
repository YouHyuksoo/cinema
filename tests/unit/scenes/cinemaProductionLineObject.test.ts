import { describe, expect, it } from 'vitest';
import { PRODUCTION_LINE_FIELDS, productionLineObject } from '@/cinema/productionLineObject';
import { DEFAULT_PRODUCTION_SNAPSHOT } from '@/cinema/productionSnapshot';
import { SCENE_FIELDS } from '@/cinema/sceneFields';
import { barTelemetryLayout } from '@/cinema/barTelemetryGeometry';
import { drawBarChart } from '@/cinema/components/drawBarChart';
import { drawTelemetryBar } from '@/cinema/components/drawTelemetryBar';

describe('production line object type', () => {
  it('declares its expected format once and shares it with the scene field table', () => {
    expect(productionLineObject.type).toBe('productionLine');
    expect(productionLineObject.fields).toBe(PRODUCTION_LINE_FIELDS);
    expect(SCENE_FIELDS.bars).toBe(PRODUCTION_LINE_FIELDS);
    expect(PRODUCTION_LINE_FIELDS.map(field => field.field)).toEqual(['value']);
    expect(PRODUCTION_LINE_FIELDS[0]).toMatchObject({ kind: 'number', min: 0, patchable: true, default: true });
  });

  it('normalizes documents with id, label and a valid value, keeping styling keys', () => {
    for (const line of DEFAULT_PRODUCTION_SNAPSHOT.lines) expect(productionLineObject.normalize(line)).toBe(line);
    expect(productionLineObject.normalize({ id: 'A', label: 'A', value: 0 })).toBeDefined();
    for (const bad of [
      { label: 'no id', value: 1 }, { id: 'A', value: 1 }, { id: 'A', label: 'A' }, { id: 'A', label: 'A', value: '1' },
      { id: 'A', label: 'A', value: -1 }, { id: 'A', label: 'A', value: 1, color: 3 }, { id: 'A', label: 'A', value: 1, accent: 'yes' }, null, 'A', [],
    ]) expect(productionLineObject.normalize(bad)).toBeUndefined();
  });

  it('describes a line with its formatted value and the snapshot unit', () => {
    expect(productionLineObject.describe({ id: 'LINE-02', label: 'LINE 02', value: 1470 }, 'EA')).toBe('LINE 02 생산량 1,470 EA');
    expect(productionLineObject.describe({ id: 'L', label: 'L', value: 5 }, '')).toBe('L 생산량 5');
  });

  it('bundles the existing layout and drawing functions unchanged', () => {
    expect(productionLineObject.layout).toBe(barTelemetryLayout);
    expect(productionLineObject.draw).toBe(drawTelemetryBar);
    expect(productionLineObject.drawAll).toBe(drawBarChart);
  });
});
