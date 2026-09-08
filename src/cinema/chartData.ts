/** The two chart scenes are different views of one simulated production snapshot. */
export const PRODUCTION_LINES = [
  { label: 'LINE 01', value: 860, color: '#5fe3ff' },
  { label: 'LINE 02', value: 720, color: '#79b7a9' },
  { label: 'LINE 03', value: 940, color: '#c4e7f0' },
  { label: 'LINE 04', value: 610, color: '#ffc168', accent: true },
  { label: 'LINE 05', value: 790, color: '#398698' },
] as const;
export const PRODUCTION_TOTAL = PRODUCTION_LINES.reduce((sum, item) => sum + item.value, 0);
export const PRODUCTION_TARGET = 800;
export const SELECTED_LINE_INDEX = 3;
