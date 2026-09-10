import { CUBE_IDENTITY, cubeApply, type CubeAxis, type CubeVec } from './filmMenuCube';

type Mat3 = typeof CUBE_IDENTITY;

/**
 * The management cube doubles as a clock: the four faces the idle showcase turns through carry the
 * time, the date, the year and the weekday, one character per sticker (row-major, 3 × 3). The top and
 * bottom faces keep their plain stickers.
 */
export const CUBE_CLOCK_AXES = ['front', 'right', 'back', 'left'] as const;
export type CubeClockAxis = (typeof CUBE_CLOCK_AXES)[number];

const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const two = (value: number) => String(value).padStart(2, '0');

/** ISO-8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
export function isoWeek(date: Date) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Nine characters per clock face: `front` time (시·분·초), `right` date (월·일), `back` year (년), `left` weekday + ISO week (주). */
export function cubeClockFaces(date: Date): Record<CubeClockAxis, string[]> {
  const year = String(date.getFullYear()).padStart(4, '0');
  const hours = two(date.getHours()), minutes = two(date.getMinutes()), seconds = two(date.getSeconds());
  const month = two(date.getMonth() + 1), day = two(date.getDate()), week = two(isoWeek(date));
  const weekday = date.getDay();
  return {
    front: [hours[0], hours[1], '시', minutes[0], minutes[1], '분', seconds[0], seconds[1], '초'],
    right: [month[0], month[1], '월', day[0], day[1], '일', '', '', ''],
    back: [year[0], year[1], '', year[2], year[3], '년', '', '', ''],
    left: [...WEEKDAYS_EN[weekday], WEEKDAYS_KO[weekday], '요', '일', week[0], week[1], '주'],
  };
}

const NORMALS: Record<CubeAxis, CubeVec> = {
  front: { x: 0, y: 0, z: 1 }, back: { x: 0, y: 0, z: -1 }, right: { x: 1, y: 0, z: 0 }, left: { x: -1, y: 0, z: 0 },
  top: { x: 0, y: -1, z: 0 }, bottom: { x: 0, y: 1, z: 0 },
};
const axisOf = (n: CubeVec): CubeAxis => n.z === 1 ? 'front' : n.z === -1 ? 'back' : n.x === 1 ? 'right' : n.x === -1 ? 'left' : n.y === -1 ? 'top' : 'bottom';

/**
 * Where a sticker currently sits after the cube's twists: the face it faces and its row/column on that
 * face (as the CSS face transforms lay them out, y down; right/back/left read right-to-left in world
 * x/z). Null for the top and bottom faces, which carry no characters.
 */
export function cubeStickerCell(orient: Mat3, home: CubeVec, homeAxis: CubeAxis): { axis: CubeClockAxis; row: number; col: number } | null {
  const axis = axisOf(cubeApply(orient, NORMALS[homeAxis]));
  if (axis === 'top' || axis === 'bottom') return null;
  const pos = cubeApply(orient, home);
  const col = axis === 'front' ? pos.x + 1 : axis === 'right' ? 1 - pos.z : axis === 'back' ? 1 - pos.x : pos.z + 1;
  return { axis, row: pos.y + 1, col };
}

/** The character a sticker shows now, or '' when its face is blank there. */
export function cubeStickerCharacter(faces: Record<CubeClockAxis, string[]>, orient: Mat3, home: CubeVec, homeAxis: CubeAxis) {
  const cell = cubeStickerCell(orient, home, homeAxis);
  return cell ? faces[cell.axis][cell.row * 3 + cell.col] ?? '' : '';
}
