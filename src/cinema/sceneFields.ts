import { PRODUCTION_LINE_FIELDS } from './productionLineFields';
import type { SceneFieldDescriptor } from './sceneField';

/** Scenes whose objects accept patches (contract level L2). */
export const PATCHABLE_SCENES = ['bars', 'wave', 'network', 'spc'] as const;
export type PatchableScene = typeof PATCHABLE_SCENES[number];

/**
 * Field descriptors per patchable scene: the single source for patch validation, HATCHERY
 * commands and tool schemas, and value formatting. Object types own their own list (bars).
 */
export const SCENE_FIELDS: Record<PatchableScene, readonly SceneFieldDescriptor[]> = {
  bars: PRODUCTION_LINE_FIELDS,
  wave: [
    { field: 'temperature', label: '온도', kind: 'number', unit: '°C', decimals: 1, patchable: true, aliases: /온도/, default: true },
    { field: 'humidity', label: '습도', kind: 'number', unit: '%', min: 0, max: 100, decimals: 0, patchable: true, aliases: /습도/ },
  ],
  network: [
    { field: 'queue', label: '대기량', kind: 'number', unit: '개', min: 0, decimals: 0, patchable: true, aliases: /대기량|대기/, default: true },
    { field: 'capacityPerHour', label: '처리능력', kind: 'number', unit: '개/시', min: 0, decimals: 0, patchable: true, aliases: /처리\s*능력|용량/ },
    { field: 'cycleSeconds', label: '사이클', kind: 'number', unit: '초', min: 0, decimals: 1, patchable: true, aliases: /사이클|택트/ },
  ],
  spc: [
    { field: 'values', label: '측정값', kind: 'number[]', patchable: true, aliases: /측정값|값/, default: true },
  ],
};

export const isPatchableScene = (value: unknown): value is PatchableScene =>
  typeof value === 'string' && (PATCHABLE_SCENES as readonly string[]).includes(value);
