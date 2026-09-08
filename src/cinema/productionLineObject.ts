import { barTelemetryLayout } from './barTelemetryGeometry';
import { drawBarChart } from './components/drawBarChart';
import { drawTelemetryBar } from './components/drawTelemetryBar';
import type { ProductionLine } from './productionSnapshot';
import { formatSceneField, validateSceneObjectFields } from './sceneField';
import { PRODUCTION_LINE_FIELDS } from './productionLineFields';

export { PRODUCTION_LINE_FIELDS } from './productionLineFields';

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * The production line as a scene object type: its field descriptors plus the methods every
 * object type owns. Instances are plain documents ({ id, label, value }); the store holds them.
 */
export const productionLineObject = {
  type: 'productionLine' as const,
  fields: PRODUCTION_LINE_FIELDS,
  /** Structural check of one raw line: id, label, declared fields and the optional styling keys. */
  normalize(raw: unknown): ProductionLine | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const line = raw as Record<string, unknown>;
    if (!isText(line.id) || !isText(line.label)) return undefined;
    if (!validateSceneObjectFields(PRODUCTION_LINE_FIELDS, line, { required: true }).ok) return undefined;
    if (line.color !== undefined && typeof line.color !== 'string') return undefined;
    if (line.accent !== undefined && typeof line.accent !== 'boolean') return undefined;
    return line as unknown as ProductionLine;
  },
  /** Spoken/tooltip form, e.g. "LINE 02 생산량 470 EA". */
  describe(line: ProductionLine, unit: string) {
    return `${line.label} ${PRODUCTION_LINE_FIELDS[0].label} ${formatSceneField(PRODUCTION_LINE_FIELDS[0], line.value)}${unit ? ` ${unit}` : ''}`;
  },
  /** Slot, scale, focus and column geometry for a list of lines in one frame. */
  layout: barTelemetryLayout,
  /** One line's luminous stack, ruler and target marker. */
  draw: drawTelemetryBar,
  /** Every line with channel headers, labels, attainment and the projected focus column. */
  drawAll: drawBarChart,
};
export type ProductionLineObject = typeof productionLineObject;
