import { DEFAULT_PRODUCTION_SNAPSHOT, type ProductionSnapshot } from './productionSnapshot';
import { DEFAULT_ENVIRONMENT_DATA, type ZoneEnvironmentData } from './zoneEnvironment';
import { DEFAULT_ENERGY_DATA, type EnergyCoreData } from './energyCore';
import { DEFAULT_PROCESS_DATA, type ProcessNetworkData } from './processNetwork';
import { DEFAULT_PRODUCT_DATA, type ProductInspectionData } from './productInspection';
import { DEFAULT_SPC_DATA } from './spcData';
import type { SpcData } from './spcTypes';
import { DEFAULT_PCB_INSPECTION_DATA, type PcbInspectionData } from './pcbInspectionData';

/** Everything a film frame reads from outside: one entry per data-driven scene family. */
export interface FilmSceneData {
  production: ProductionSnapshot;
  environment: ZoneEnvironmentData;
  energy: EnergyCoreData;
  network: ProcessNetworkData;
  product: ProductInspectionData;
  spc: SpcData;
  pcb: PcbInspectionData;
}
export type FilmSceneDataKey = keyof FilmSceneData;

export const DEFAULT_FILM_SCENE_DATA: FilmSceneData = {
  production: DEFAULT_PRODUCTION_SNAPSHOT,
  environment: DEFAULT_ENVIRONMENT_DATA,
  energy: DEFAULT_ENERGY_DATA,
  network: DEFAULT_PROCESS_DATA,
  product: DEFAULT_PRODUCT_DATA,
  spc: DEFAULT_SPC_DATA,
  pcb: DEFAULT_PCB_INSPECTION_DATA,
};

/** Keys absent or undefined in the change keep their current data. */
export function mergeFilmSceneData(base: FilmSceneData, change: Partial<FilmSceneData>): FilmSceneData {
  const next = { ...base };
  for (const key of Object.keys(change) as FilmSceneDataKey[]) {
    const value = change[key];
    if (value !== undefined) (next as Record<FilmSceneDataKey, unknown>)[key] = value;
  }
  return next;
}
