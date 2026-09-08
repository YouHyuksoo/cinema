export const PCB_COMPONENT_KINDS = ['ic', 'resistor', 'capacitor', 'connector'] as const;
export const PCB_DEFECT_CODES = ['none', 'uninspected', 'insufficient_solder', 'offset', 'bridge'] as const;
export const PCB_INSPECTION_PROCESSES = ['spi', 'maoi', 'aoi'] as const;
export const PCB_COMPONENT_KIND_LABELS = { ic: 'IC', resistor: '저항', capacitor: '커패시터', connector: '커넥터' } as const;
export const PCB_DEFECT_LABELS = { none: '정상', uninspected: '미검사', insufficient_solder: '납량 부족', offset: '부품 위치 편차', bridge: '납땜 브리지' } as const;
export const PCB_INSPECTION_PROCESS_LABELS = { spi: 'SPI', maoi: 'MAOI', aoi: 'AOI' } as const;

/** Dimensions and center-relative coordinates are millimetres; rotation is degrees. */
export interface PcbComponent {
  id: string;
  label: string;
  partNumber: string;
  kind: typeof PCB_COMPONENT_KINDS[number];
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
  defect: typeof PCB_DEFECT_CODES[number];
  process: typeof PCB_INSPECTION_PROCESSES[number];
}
export interface PcbInspectionData {
  name: string;
  serial: string;
  width: number;
  height: number;
  thickness: number;
  components: readonly PcbComponent[];
}

const part = (id: string, kind: PcbComponent['kind'], x: number, y: number, width: number, height: number,
  defect: PcbComponent['defect'] = 'none', process: PcbComponent['process'] = 'aoi'): PcbComponent => ({
  id, label: id, partNumber: `${kind.toUpperCase()}-${id}`, kind, x, y, width, height,
  rotation: 0, depth: kind === 'connector' ? 5 : kind === 'ic' ? 2 : 1, defect, process,
});

export const DEFAULT_PCB_INSPECTION_DATA: PcbInspectionData = {
  name: 'SMT CONTROL BOARD', serial: 'PCB-DEMO-001', width: 160, height: 100, thickness: 1.6,
  components: [
    { ...part('U1', 'ic', -46, -23, 16, 12, 'insufficient_solder', 'spi'), label: '전원 IC' },
    { ...part('R12', 'resistor', 2, 25, 6, 3, 'offset', 'maoi'), label: '센싱 저항' },
    { ...part('U3', 'ic', 47, -4, 18, 14, 'bridge', 'aoi'), label: '통신 IC' },
    part('U2', 'ic', -10, -18, 20, 16), part('U4', 'ic', 30, 28, 14, 10),
    part('U5', 'ic', -48, 20, 12, 10), part('U6', 'ic', 20, -26, 10, 8),
    part('J1', 'connector', -70, 0, 9, 26), part('J2', 'connector', 68, 20, 10, 30),
    part('J3', 'connector', 0, -42, 28, 8),
    ...Array.from({ length: 18 }, (_, i) => part(`R${i < 11 ? i + 1 : i + 2}`, 'resistor', i === 8 ? 60 : -54 + i % 9 * 12, -5 + Math.floor(i / 9) * 16, 4, 2)),
    ...Array.from({ length: 12 }, (_, i) => part(`C${i + 1}`, 'capacitor', -55 + i % 6 * 19, 37 + Math.floor(i / 6) * -71, 4, 3)),
  ],
};
