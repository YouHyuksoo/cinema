import { smooth } from './filmDrawing';
import { createHoloProjection, type HoloPoint } from './holoSpace';

export const RADAR_FILM_SECONDS = 24;
export const RADAR_RADIUS = 236;
export const RADAR_SCAN_START = 1.5;
export interface RadarContact { id: string; label: string; rangeKm: number; bearingDeg: number; strength: number }
export interface RadarSignalData { title: string; rangeKm: number; scanSeconds: number; contacts: readonly RadarContact[] }
export const DEFAULT_RADAR_DATA: RadarSignalData = {
  title: 'SECTOR 07 / SIGNAL SEARCH', rangeKm: 15, scanSeconds: 6,
  contacts: [
    { id: 'echo-01', label: 'ECHO 01', rangeKm: 6.4, bearingDeg: 42, strength: .62 },
    { id: 'echo-02', label: 'ECHO 02', rangeKm: 9.2, bearingDeg: 128, strength: .94 },
    { id: 'echo-03', label: 'ECHO 03', rangeKm: 11.8, bearingDeg: 278, strength: .48 },
  ],
};
export const radarBearing = (degrees: number) => ((degrees % 360) + 360) % 360;

/** North is zero, east is 90; range always uses the same physical scale. */
export function radarPolarPoint(rangeRatio: number, bearingDeg: number, z = 0): HoloPoint {
  const angle = bearingDeg * Math.PI / 180;
  return { x: Math.sin(angle) * RADAR_RADIUS * rangeRatio, y: -Math.cos(angle) * RADAR_RADIUS * rangeRatio, z };
}

/** Detection is computed from absolute sweep time, including reverse seeks and multiple revolutions. */
export function radarSignalState(time: number, data: RadarSignalData = DEFAULT_RADAR_DATA) {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(RADAR_FILM_SECONDS, time)) : 0;
  const period = Number.isFinite(data.scanSeconds) && data.scanSeconds > 0 ? data.scanSeconds : 6;
  const scanTime = Math.max(0, elapsed - RADAR_SCAN_START);
  const scanBearing = (scanTime / period * 360) % 360;
  const validRange = Number.isFinite(data.rangeKm) && data.rangeKm > 0;
  const eligible = validRange ? data.contacts.filter(contact => [contact.rangeKm, contact.bearingDeg, contact.strength].every(Number.isFinite)
    && contact.rangeKm >= 0 && contact.rangeKm <= data.rangeKm && contact.strength >= 0 && contact.strength <= 1) : [];
  const strongest = eligible.reduce<RadarContact | undefined>((best, contact) => !best || contact.strength > best.strength ? contact : best, undefined);
  const focusWindow = smooth(7, 9.5, elapsed) * (1 - smooth(17.5, 20.5, elapsed));
  const contacts = eligible.map(contact => {
    const bearing = radarBearing(contact.bearingDeg);
    const firstPass = RADAR_SCAN_START + bearing / 360 * period;
    const detected = elapsed >= firstPass;
    const age = detected ? (elapsed - firstPass) % period : 0;
    const selected = contact.id === strongest?.id;
    const focus = selected && detected ? focusWindow : 0;
    const base = radarPolarPoint(contact.rangeKm / data.rangeKm, bearing);
    // Northern rim contacts already sit high in the scene; move them in depth
    // without lifting them through the fixed heading.
    const lift = Math.min(90, Math.max(0, base.y + 90));
    const point = { ...base, y: base.y - focus * lift, z: -focus * 110 };
    return { contact, bearing, detected, age, selected, focus, base, point,
      echo: detected ? .22 + .78 * Math.exp(-age / 1.6) : 0 };
  });
  const target = contacts.find(contact => contact.selected && contact.detected);
  const focus = target?.focus ?? 0;
  const project = createHoloProjection({ x: 480, y: 369, yaw: -.12, pitch: .44,
    scale: 1.04 + focus * .035, distance: 1050 });
  return { elapsed, period, scanBearing, contacts, target, focus, project,
    reveal: smooth(.1, 1.6, elapsed) * (1 - smooth(22, 24, elapsed)),
    readout: target ? smooth(9.2, 10.8, elapsed) * (1 - smooth(17.5, 19.5, elapsed)) : 0,
    acquired: contacts.filter(contact => contact.detected).length };
}
export type RadarSignalState = ReturnType<typeof radarSignalState>;
