import type { SceneFieldDescriptor } from './sceneField';

/** Expected format of one production line; targets and units come from the snapshot data. */
export const PRODUCTION_LINE_FIELDS: readonly SceneFieldDescriptor[] = [
  { field: 'value', label: '생산량', kind: 'number', min: 0, decimals: 0, patchable: true, aliases: /생산량|실적|수량|값/, default: true },
];
