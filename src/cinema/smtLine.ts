/** Visual proportions, not installation dimensions. Order supplied by the operator. */
export const SMT_LINE = [
  { id: 'loader', label: 'PCB 로더', english: 'PCB LOADER', width: 105, height: 195 },
  { id: 'printer', label: '스크린프린터', english: 'SCREEN PRINTER', width: 170, height: 180 },
  { id: 'spi', label: 'SPI', english: '3D SPI', width: 130, height: 175 },
  { id: 'mounter', label: '마운터', english: 'CHIP MOUNTER', width: 220, height: 180 },
  { id: 'maoi', label: 'MAOI', english: 'POST-MOUNT AOI', width: 140, height: 190 },
  { id: 'reflow', label: '리플로우', english: 'REFLOW OVEN', width: 330, height: 145 },
  { id: 'aoi', label: 'AOI', english: '3D AOI', width: 140, height: 190 },
  { id: 'unloader', label: '언로더', english: 'PCB UNLOADER', width: 105, height: 195 },
] as const;
export type SmtEquipment = typeof SMT_LINE[number];
export const SMT_GAP = 24;
export const SMT_LINE_WIDTH = SMT_LINE.reduce((sum, item) => sum + item.width, 0) + SMT_GAP * (SMT_LINE.length - 1);
export const SMT_STATIONS = SMT_LINE.map((equipment, index) => ({
  ...equipment, order: index + 1,
  x: SMT_LINE.slice(0, index).reduce((sum, item) => sum + item.width + SMT_GAP, 0) + equipment.width / 2,
}));
export const SMT_THERMAL_TARGET = SMT_STATIONS.find(station => station.id === 'reflow')!;
