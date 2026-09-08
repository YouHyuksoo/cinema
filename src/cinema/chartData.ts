import { DEFAULT_PRODUCTION_SNAPSHOT, productionSnapshotState } from './productionSnapshot';

/** Legacy view of the default snapshot; the pie scene still reads these. The bar scene takes a snapshot directly. */
const state = productionSnapshotState(DEFAULT_PRODUCTION_SNAPSHOT);
export const PRODUCTION_LINES = state.lines.map(line => ({ ...line, color: line.color ?? '#5fe3ff' }));
export const PRODUCTION_TOTAL = state.total;
export const PRODUCTION_TARGET = state.target;
export const SELECTED_LINE_INDEX = state.selectedIndex ?? 0;
