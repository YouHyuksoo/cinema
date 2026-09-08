/** Every scene object carries a domain code as its id; the label is only for display. */
export interface SceneObject { id: string; label: string }
export interface MetricObject extends SceneObject { value: number; unit?: string }

const cleanId = (id: unknown) => typeof id === 'string' ? id.trim() : '';

/** Drops blank ids and later duplicates; a blank label falls back to the id. Untouched objects are returned as-is. */
export function normalizeSceneObjects<T extends SceneObject>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items ?? []) {
    const id = cleanId(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = typeof item.label === 'string' && item.label.trim() ? item.label : id;
    result.push(id === item.id && label === item.label ? item : { ...item, id, label });
  }
  return result;
}

export function findSceneObject<T extends SceneObject>(items: readonly T[], id: string | null | undefined): T | undefined {
  const wanted = cleanId(id);
  return wanted ? items.find(item => item.id === wanted) : undefined;
}
