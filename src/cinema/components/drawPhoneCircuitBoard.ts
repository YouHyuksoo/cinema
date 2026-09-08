import { signalColor, type FilmFonts } from '../filmDrawing';
import type { HoloPoint } from '../holoSpace';
import { phoneCircle, phoneLabel, phonePath, phonePlate, type PhoneProject } from './phoneDrawing';

type Route = readonly (readonly [number, number])[];
const COPPER = '#b89b56';
const ROUTES: readonly Route[] = [
  [[24, -118], [18, -118], [14, -122], [2, -122]],
  [[24, -111], [18, -111], [14, -115], [2, -115]],
  [[24, -104], [18, -104], [14, -108], [2, -108]],
  [[24, -97], [18, -97], [14, -101], [2, -101]],
  [[31, -129], [31, -138], [40, -147], [68, -147], [77, -156]],
  [[38, -129], [38, -135], [46, -143], [75, -143], [86, -154]],
  [[45, -129], [45, -134], [50, -139], [86, -139], [93, -146], [93, -165]],
  [[72, -119], [80, -119], [91, -130], [91, -141]],
  [[72, -112], [86, -112], [99, -125], [99, -150]],
  [[72, -96], [84, -96], [94, -86], [94, -64], [87, -57]],
  [[35, -83], [35, -76], [42, -69], [42, -57]],
  [[42, -83], [42, -78], [48, -72], [48, -57]],
  [[49, -83], [49, -80], [55, -74], [55, -57]],
  [[56, -83], [65, -74], [83, -74], [96, -61], [96, -49]],
  [[62, -83], [69, -76], [87, -76], [101, -62], [101, -48]],
  [[-44, -143], [-29, -143], [-22, -136], [-22, -97], [-13, -88]],
  [[-44, -137], [-35, -137], [-29, -131], [-29, -94], [-16, -81]],
  [[-45, -95], [-37, -95], [-26, -84], [-26, -62]],
  [[-77, -77], [-91, -63], [-91, 144], [-77, 158], [-43, 158]],
  [[-85, -144], [-98, -131], [-98, 152], [-85, 165], [-73, 165]],
  [[20, -59], [9, -59], [-4, -46], [-79, -46], [-85, -40], [-85, 153], [-65, 173]],
  [[55, 157], [55, 167], [37, 175], [16, 175]],
  [[-14, 163], [-23, 154], [-38, 154], [-48, 164]],
];

function pad(ctx: CanvasRenderingContext2D, project: PhoneProject, x: number, y: number,
  width: number, height: number, z: number, fill: string) {
  phonePath(ctx, project, [{ x: x - width / 2, y: y - height / 2, z }, { x: x + width / 2, y: y - height / 2, z },
    { x: x + width / 2, y: y + height / 2, z }, { x: x - width / 2, y: y + height / 2, z }], true);
  ctx.fillStyle = fill; ctx.fill();
}

/** Small manufactured passives have raised ceramic bodies and a metal terminal at each end. */
function passive(ctx: CanvasRenderingContext2D, project: PhoneProject, x: number, y: number,
  vertical = false, dark = false) {
  const width = vertical ? 3.4 : 7, height = vertical ? 7 : 3.4;
  pad(ctx, project, x + .4, y + .6, width, height, -2, '#122320');
  pad(ctx, project, x, y, width, height, -4, '#b7bab1');
  pad(ctx, project, x, y, vertical ? width : width * .52, vertical ? height * .52 : height,
    -4.2, dark ? '#29302d' : '#9a8156');
}

function chip(ctx: CanvasRenderingContext2D, project: PhoneProject, fonts: FilmFonts,
  x: number, y: number, width: number, height: number, name: string, cpu = false, focus = 0) {
  const pins = cpu ? 8 : 6;
  for (let index = 0; index < pins; index++) {
    const u = (index + .5) / pins - .5;
    for (const sign of [-1, 1]) {
      pad(ctx, project, x + u * (width - 7), y + sign * (height / 2 + 2), 2.1, 5, -3, '#bcb89c');
      pad(ctx, project, x + sign * (width / 2 + 2), y + u * (height - 7), 5, 2.1, -3, '#bcb89c');
    }
  }
  // The processor front is z=-8, exactly matching the shared focus anchor.
  phonePlate(ctx, project, { x, y, z: -5.5, width, height, depth: 5, radius: 1.8,
    fill: '#11191e', side: '#03090d', edge: cpu ? '#87938b' : '#53635d' });
  const inset = 3;
  phonePath(ctx, project, [{ x: x - width / 2 + inset, y: y - height / 2 + inset, z: -8.1 },
    { x: x + width / 2 - inset, y: y - height / 2 + inset, z: -8.1 },
    { x: x + width / 2 - inset, y: y + height / 2 - inset, z: -8.1 },
    { x: x - width / 2 + inset, y: y + height / 2 - inset, z: -8.1 }], true);
  ctx.strokeStyle = cpu ? signalColor(.65, .2 + focus * .7) : '#46534c'; ctx.lineWidth = .7; ctx.stroke();
  phoneLabel(ctx, project, name, x, y - 1, -8.2, cpu ? 8 : 5.4, fonts.mono, '#b8c6ba', 'center');
  phoneLabel(ctx, project, cpu ? 'SOC / 04' : name === 'LPDDR' ? 'LPDDR5' : 'POWER IC',
    x, y + 8, -8.2, 4.4, fonts.mono, '#6c8778', 'center');
  phoneCircle(ctx, project, x - width / 2 + 6, y - height / 2 + 6, -8.1, 1.5);
  ctx.fillStyle = '#a8b2a0'; ctx.fill();
}

function cameraLens(ctx: CanvasRenderingContext2D, project: PhoneProject, x: number, y: number) {
  const rings = [
    { radius: 17, z: -4.4, fill: '#7d868e', edge: '#c6cbd0' },
    { radius: 15.1, z: -5.5, fill: '#0b0e12', edge: '#272e34' },
    { radius: 12.2, z: -6.2, fill: '#1c2c42', edge: '#5b728a' },
    { radius: 8.8, z: -7.2, fill: '#0b111d', edge: '#2c405c' },
    { radius: 4.3, z: -7.6, fill: '#020407', edge: '#19304c' },
  ];
  for (const ring of rings) {
    phoneCircle(ctx, project, x, y, ring.z, ring.radius);
    ctx.fillStyle = ring.fill; ctx.fill(); ctx.strokeStyle = ring.edge; ctx.lineWidth = .7; ctx.stroke();
  }
  phoneCircle(ctx, project, x - 4.3, y - 4.1, -7.9, 2.4); ctx.fillStyle = '#6d96c0'; ctx.fill();
  phoneCircle(ctx, project, x + 3.2, y + 2.5, -7.9, .8); ctx.fillStyle = '#edf0f2'; ctx.fill();
}

/** One removable 48 × 92 × 16 camera cassette, centered on its own layer origin. */
export function drawPhoneCameraModule(ctx: CanvasRenderingContext2D, project: PhoneProject,
  fonts: FilmFonts, time: number, focus: number): void {
  const emphasis = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
  const elapsed = Number.isFinite(time) ? time : 0;
  ctx.save(); ctx.shadowBlur = 0; ctx.setLineDash([]);
  phonePlate(ctx, project, { x: 0, y: 0, z: 2, width: 48, height: 92, depth: 12, radius: 7,
    fill: '#292e35', side: '#0c1116', edge: '#a6b0b8' });
  cameraLens(ctx, project, 0, -22); cameraLens(ctx, project, 0, 22);
  for (const x of [-18.5, 18.5]) for (const y of [-39, 39]) {
    phoneCircle(ctx, project, x, y, -4.2, 1.7); ctx.fillStyle = '#bbc1c6'; ctx.fill();
    phonePath(ctx, project, [{ x: x - 1, y, z: -4.3 }, { x: x + 1, y, z: -4.3 }]);
    ctx.strokeStyle = '#424951'; ctx.lineWidth = .6; ctx.stroke();
  }
  phoneLabel(ctx, project, 'DUAL CAMERA', 0, 2, -4.3, 4.6, fonts.mono, '#b9c2c9', 'center');
  phoneLabel(ctx, project, 'CAM / M02', 0, 43, -4.3, 3.5, fonts.mono, '#86939d', 'center');
  if (emphasis > .001) {
    phonePath(ctx, project, [{ x: -21, y: -38, z: -4.4 }, { x: -21, y: 37, z: -4.4 }]);
    ctx.strokeStyle = `rgba(227,236,242,${emphasis * (.5 + Math.sin(elapsed * .35) * .12)})`;
    ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
}

/** A separate opaque foil cell, with its printed specification on the physical face. */
export function drawPhoneBattery(ctx: CanvasRenderingContext2D, project: PhoneProject,
  fonts: FilmFonts, time: number, focus: number): void {
  const emphasis = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
  const elapsed = Number.isFinite(time) ? time : 0;
  ctx.save(); ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.setLineDash([]);
  phonePlate(ctx, project, { x: 0, y: 0, z: 0, width: 150, height: 212, depth: 8, radius: 6,
    fill: '#171b20', edge: '#abb4bc', side: '#070a0d' });
  phonePath(ctx, project, [{ x: -70, y: -97, z: -4.1 }, { x: 69, y: -97, z: -4.1 },
    { x: 69, y: 97, z: -4.1 }, { x: -70, y: 97, z: -4.1 }], true);
  ctx.strokeStyle = '#58616c'; ctx.lineWidth = 1; ctx.stroke();
  phonePath(ctx, project, [{ x: -72, y: -92, z: -4.2 }, { x: -72, y: 89, z: -4.2 },
    { x: -67, y: 100, z: -4.2 }, { x: 65, y: 100, z: -4.2 }]);
  ctx.strokeStyle = '#b1bac2'; ctx.lineWidth = .8; ctx.stroke();
  for (const x of [-30, 30]) pad(ctx, project, x, -101, 17, 7, -4.2, '#bf9f60');
  phoneLabel(ctx, project, '+', -30, -84, -4.3, 9, fonts.mono, '#d6dbe0', 'center');
  phoneLabel(ctx, project, '−', 30, -84, -4.3, 9, fonts.mono, '#d6dbe0', 'center');
  phoneLabel(ctx, project, 'Li-ion', 0, -53, -4.3, 17, fonts.mono, '#e2e6e9', 'center');
  phoneLabel(ctx, project, '3.85 V', 0, -26, -4.3, 20, fonts.mono, '#d4dbe1', 'center');
  phoneLabel(ctx, project, '5050 mAh', 0, 0, -4.3, 17, fonts.mono, '#c5cfd8', 'center');
  phoneLabel(ctx, project, '19.44 Wh', 0, 20, -4.3, 9, fonts.mono, '#9eaab5', 'center');
  phoneLabel(ctx, project, 'RECHARGEABLE CELL', 0, 38, -4.3, 6.5, fonts.mono, '#b4bec7', 'center');
  phoneLabel(ctx, project, 'DO NOT PUNCTURE', 0, 52, -4.3, 5.5, fonts.mono, '#8998a5', 'center');
  for (let index = 0; index < 36; index++) {
    pad(ctx, project, -45 + index * 2.55, 73, index % 5 === 0 ? 1.6 : .65, 13, -4.3, '#9aa7b2');
  }
  phoneLabel(ctx, project, 'MODEL B-5050', 0, 90, -4.3, 5.6, fonts.mono, '#a4b0bb', 'center');
  if (emphasis > .001) {
    phonePath(ctx, project, [{ x: 72, y: -91, z: -4.4 }, { x: 72, y: 92, z: -4.4 }]);
    ctx.strokeStyle = `rgba(222,229,236,${emphasis * (.55 + Math.sin(elapsed * .3) * .1)})`;
    ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
}

function boardSubstrate(ctx: CanvasRenderingContext2D, project: PhoneProject) {
  // The large central battery opening is real empty geometry, not a dark rectangle painted over a plate.
  const front: HoloPoint[] = [[-93, -189], [93, -189], [105, -177], [105, -44], [-77, -44],
    [-77, 150], [105, 150], [105, 177], [93, 189], [-93, 189], [-105, 177], [-105, -177]]
    .map(([x, y]) => ({ x, y, z: -1.5 }));
  const rear = front.map(point => ({ ...point, z: 1.5 }));
  phonePath(ctx, project, rear, true); ctx.fillStyle = '#08261a'; ctx.fill();
  const walls = front.map((point, index) => {
    const next = (index + 1) % front.length;
    const points = [point, front[next], rear[next], rear[index]];
    return { points, depth: points.reduce((sum, vertex) => sum + project(vertex).depth, 0) };
  }).sort((a, b) => b.depth - a.depth);
  for (const wall of walls) {
    phonePath(ctx, project, wall.points, true); ctx.fillStyle = '#2b4735'; ctx.fill();
  }
  phonePath(ctx, project, front, true); ctx.fillStyle = '#163d2e'; ctx.fill();
  ctx.strokeStyle = '#64816b'; ctx.lineWidth = 1; ctx.stroke();
}

/** A populated phone PCB: model geometry stays fixed while the caller moves its whole layer. */
export function drawPhoneCircuitBoard(ctx: CanvasRenderingContext2D, project: PhoneProject,
  fonts: FilmFonts, time: number, focus: number): void {
  const elapsed = Number.isFinite(time) ? time : 0;
  const emphasis = Number.isFinite(focus) ? Math.max(0, Math.min(1, focus)) : 0;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.shadowBlur = 0;
  boardSubstrate(ctx, project);

  for (const [index, route] of ROUTES.entries()) {
    const points = route.map(([x, y]) => ({ x, y, z: -1.8 }));
    phonePath(ctx, project, points); ctx.strokeStyle = index < 15 ? '#ac9651' : '#54705c';
    ctx.lineWidth = index < 15 ? .9 : .65; ctx.stroke();
    for (const endpoint of [points[0], points[points.length - 1]]) {
      phoneCircle(ctx, project, endpoint.x, endpoint.y, -1.9, 1.35);
      ctx.fillStyle = '#ccba74'; ctx.fill(); ctx.strokeStyle = '#163d2c'; ctx.lineWidth = .6; ctx.stroke();
    }
  }

  // Ground stitching is kept to useful perimeter and component-bank locations.
  for (const x of [-100, 99]) for (const y of [-168, -119, -70, -13, 37, 89, 131, 163]) {
    if (x > -77 && y > -44 && y < 150) continue;
    phoneCircle(ctx, project, x, y, -1.7, 1.6); ctx.fillStyle = COPPER; ctx.fill();
    phoneCircle(ctx, project, x, y, -1.8, .7); ctx.fillStyle = '#08251f'; ctx.fill();
  }
  for (const [x, y] of [[-90, -174], [89, -175], [-91, 176], [89, 176]]) {
    phoneCircle(ctx, project, x, y, -2, 4); ctx.fillStyle = '#d2c285'; ctx.fill();
    phoneCircle(ctx, project, x, y, -2.1, 2.1); ctx.fillStyle = '#03120e'; ctx.fill();
  }

  // Regular banks are circuit groups, not a background noise grid.
  for (let index = 0; index < 8; index++) {
    passive(ctx, project, -24 + index * 8, -174, true, index % 3 === 0);
    passive(ctx, project, -18 + index * 9, -66, true, index % 2 === 0);
  }
  for (let row = 0; row < 5; row++) {
    passive(ctx, project, 84, -117 + row * 9, false, row % 2 === 0);
    passive(ctx, project, -35, -121 + row * 10, true, row % 2 === 1);
  }
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    passive(ctx, project, 76 + column * 8, -70 + row * 9, true, column === 1);
    passive(ctx, project, -95 + column * 6, -13 + row * 44, true, row === 0);
  }
  for (let index = 0; index < 6; index++) passive(ctx, project, -25 + index * 10, 165, true, index % 2 === 0);

  // Empty FPC sockets show where the separately lifted dual-camera cassette was mounted.
  for (const y of [-141, -98]) {
    phonePlate(ctx, project, { x: -65, y, z: -3.5, width: 34, height: 16, depth: 4, radius: 1.5,
      fill: '#15191c', edge: '#aeb5b6', side: '#080d0f' });
    for (let pin = 0; pin < 10; pin++) pad(ctx, project, -78 + pin * 2.9, y, 1.2, 8, -5.6, '#cbb67e');
  }
  phonePlate(ctx, project, { x: 6, y: -153, z: -4, width: 68, height: 24, depth: 4, radius: 2,
    fill: '#929b9f', edge: '#c9cdd0', side: '#505b63' });
  phoneLabel(ctx, project, 'EMI SHIELD', 6, -151, -6.1, 5.4, fonts.mono, '#303b43', 'center');
  phonePlate(ctx, project, { x: 79, y: -166, z: -4, width: 29, height: 28, depth: 4, radius: 2,
    fill: '#7f8a93', edge: '#c1c8cd', side: '#444e56' });
  phoneLabel(ctx, project, 'RF', 79, -164, -6.1, 7, fonts.mono, '#1c3a2c', 'center');
  chip(ctx, project, fonts, -1, -102, 30, 46, 'LPDDR', false);
  chip(ctx, project, fonts, 48, -106, 48, 46, 'AP / CPU', true, emphasis);
  chip(ctx, project, fonts, 46, -60, 43, 23, 'PMIC');

  phonePlate(ctx, project, { x: -49, y: -62, z: -3.5, width: 79, height: 27, depth: 4, radius: 2,
    fill: '#929dA4', edge: '#c8ced3', side: '#52616a' });
  for (let index = 0; index < 6; index++) {
    pad(ctx, project, -72 + index * 9, -62, 5.5, 15, -5.6, index % 2 ? '#667983' : '#c3c9cd');
  }
  phoneLabel(ctx, project, 'SIM / J04', -48, -45, -2, 4.8, fonts.mono, '#b2bea1', 'center');

  // A short folded connector hangs off the motherboard; nothing spans the empty battery opening.
  const flex: HoloPoint[] = [{ x: 77, y: -55, z: -3 }, { x: 91, y: -55, z: -3 },
    { x: 91, y: -40, z: -6 }, { x: 82, y: -25, z: -13 }, { x: 65, y: -25, z: -13 },
    { x: 65, y: -35, z: -13 }, { x: 76, y: -35, z: -13 }, { x: 77, y: -43, z: -6 }];
  phonePath(ctx, project, flex, true); ctx.fillStyle = '#9b7138'; ctx.fill();
  ctx.strokeStyle = '#d1a86d'; ctx.lineWidth = .7; ctx.stroke();
  for (let index = 0; index < 4; index++) {
    const x = 79 + index * 2;
    phonePath(ctx, project, [{ x, y: -51, z: -3.1 }, { x, y: -40, z: -6.1 },
      { x: 78 + index, y: -32 + index, z: -13.1 }, { x: 66, y: -32 + index, z: -13.1 }]);
    ctx.strokeStyle = '#ebc881'; ctx.lineWidth = .7; ctx.stroke();
  }
  phoneLabel(ctx, project, 'FPC', 73, -27, -13.2, 3.5, fonts.mono, '#503b23', 'center');

  for (const x of [-18, 34]) {
    phonePlate(ctx, project, { x, y: 156, z: -4, width: 30, height: 10, depth: 4, radius: 1,
      fill: '#15251c', edge: '#a39b77', side: '#08170e' });
    for (let pin = 0; pin < 10; pin++) pad(ctx, project, x - 12 + pin * 2.7, 156, 1.2, 6, -6.2, '#e0c079');
  }
  phonePlate(ctx, project, { x: -65, y: 168, z: -5, width: 48, height: 30, depth: 6, radius: 4,
    fill: '#12181c', edge: '#75818a', side: '#080c0e' });
  for (let slot = 0; slot < 6; slot++) {
    phonePath(ctx, project, [{ x: -80 + slot * 6, y: 158, z: -8.1 }, { x: -80 + slot * 6, y: 178, z: -8.1 }]);
    ctx.strokeStyle = '#687580'; ctx.lineWidth = 2; ctx.stroke();
  }
  phoneCircle(ctx, project, 78, 169, -5, 13); ctx.fillStyle = '#8d99a2'; ctx.fill();
  ctx.strokeStyle = '#c2c8cc'; ctx.lineWidth = 1; ctx.stroke();
  phoneCircle(ctx, project, 78, 169, -5.2, 8); ctx.fillStyle = '#485b67'; ctx.fill();
  phoneLabel(ctx, project, 'M1', 78, 171, -5.4, 5.5, fonts.mono, '#d0d5d9', 'center');
  phonePlate(ctx, project, { x: 0, y: 174, z: -5, width: 38, height: 17, depth: 7, radius: 5,
    fill: '#8e9f96', edge: '#d2dbc8', side: '#4c6455' });
  phonePlate(ctx, project, { x: 0, y: 174, z: -8.6, width: 29, height: 8, depth: .4, radius: 3,
    fill: '#0a1511', edge: '#354b3e' });
  for (let pin = 0; pin < 10; pin++) pad(ctx, project, -11 + pin * 2.4, 175, .8, 2, -8.9, '#c5b98b');

  for (const [value, x, y] of [['U01', 20, -134], ['C18', 72, -46], ['CAM1', -91, -161],
    ['R24', -41, -79], ['J08', 17, 153], ['PCB / REV.C', -61, 187]] as const) {
    phoneLabel(ctx, project, value, x, y, -2, 4.5, fonts.mono, '#bacbb4');
  }
  if (emphasis > .001) {
    const pulse = .65 + Math.sin(elapsed * 3) * .2;
    phonePath(ctx, project, [{ x: 24, y: -129, z: -8.3 }, { x: 72, y: -129, z: -8.3 },
      { x: 72, y: -83, z: -8.3 }, { x: 24, y: -83, z: -8.3 }], true);
    ctx.strokeStyle = signalColor(.75, emphasis * pulse); ctx.lineWidth = 1.3;
    ctx.shadowColor = signalColor(.75, emphasis * .6); ctx.shadowBlur = 7; ctx.stroke();
  }
  ctx.restore();
}
