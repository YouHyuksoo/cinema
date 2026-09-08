import { DEFAULT_PRODUCTION_SNAPSHOT, type ProductionSnapshot } from './productionSnapshot';

/** Everything a film frame reads from outside: one entry per data-driven scene. */
export interface FilmSceneData { production: ProductionSnapshot }

export const DEFAULT_FILM_SCENE_DATA: FilmSceneData = { production: DEFAULT_PRODUCTION_SNAPSHOT };

/** Scenes not named in the change keep their current data. */
export function mergeFilmSceneData(base: FilmSceneData, change: Partial<FilmSceneData>): FilmSceneData {
  return { ...base, ...(change.production ? { production: change.production } : {}) };
}
