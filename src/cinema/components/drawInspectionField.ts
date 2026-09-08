import { signalColor, type FilmFonts } from '../filmDrawing';
import {
  INSPECTION_STATIONS, fillSpatialPolygon, inspectionCameraPoint, inspectionFocusPoint, inspectionStation, projectInspectionPoint,
  spatialLabel, strokeSpatialPath, type InspectionCamera, type InspectionStation, type Point3D,
} from '../inspectionSpace';

function equipment(ctx: CanvasRenderingContext2D, fonts: FilmFonts, camera: InspectionCamera,
  station: InspectionStation, time: number, focus: number, heat: number, selectedId: InspectionStation['id']) {
  const selected = station.id === selectedId;
  const warm = selected ? heat : 0;
  const opacity = selected ? .7 + focus * .3 : .46 - focus * .16;
  const front = station.z - 75;
  const p = (x: number, y: number, z = front): Point3D =>
    inspectionFocusPoint({ x: station.x + x, y, z }, selected ? focus : 0);
  const path = (points: readonly Point3D[], strength: number, width = 1) =>
    strokeSpatialPath(ctx, camera, points, signalColor(warm, opacity * strength), width);
  const face = (points: readonly Point3D[], fill: string, edge = .45) =>
    fillSpatialPolygon(ctx, camera, points, fill, signalColor(warm, opacity * edge));
  const rectangle = (left: number, bottom: number, right: number, top: number, fill: string, edge = .45) =>
    face([p(left, bottom, front - .8), p(right, bottom, front - .8), p(right, top, front - .8), p(left, top, front - .8)], fill, edge);

  // Closed faces are painted far-to-near; roof and sides expose the actual cabinet depth.
  const faces = [
    { points: [p(-72, 0), p(-72, 0, station.z + 75), p(72, 0, station.z + 75), p(72, 0)], fill: '#061923' },
    { points: [p(-72, 0), p(-72, 0, station.z + 75), p(-72, 176, station.z + 75), p(-72, 176)], fill: '#102b37' },
    { points: [p(72, 0), p(72, 176), p(72, 176, station.z + 75), p(72, 0, station.z + 75)], fill: '#173743' },
    { points: [p(-72, 176), p(-72, 176, station.z + 75), p(72, 176, station.z + 75), p(72, 176)], fill: '#224653' },
    { points: [p(-72, 0), p(72, 0), p(72, 176), p(-72, 176)], fill: '#0b202a' },
  ];
  const depth = (points: readonly Point3D[]) => points.reduce((sum, point) => sum + inspectionCameraPoint(camera, point).z, 0) / points.length;
  faces.sort((a, b) => depth(b.points) - depth(a.points));
  faces.forEach(({ points, fill }) => face(points, fill, .56));

  path([p(-52, 177, station.z - 50), p(-52, 177, station.z + 52), p(52, 177, station.z + 52), p(52, 177, station.z - 50)], .3);
  const side = camera.x > station.x ? 1 : -1;
  path([p(side * 72.5, 32, station.z - 50), p(side * 72.5, 32, station.z + 50), p(side * 72.5, 136, station.z + 50)], .27);
  path([p(side * 72.5, 126, station.z - 50), p(side * 72.5, 126, station.z + 50)], .27);
  for (let rib = 0; rib < 6; rib++) {
    path([p(side * 73, 54, station.z - 35 + rib * 13), p(side * 73, 112, station.z - 35 + rib * 13)], .17);
  }

  rectangle(-63, 133, 63, 165, '#102e3b', .4);
  rectangle(-57, 48, 57, 121, '#05151e', .7);
  rectangle(-52, 55, 52, 115, signalColor(warm, .045), .18);
  path([p(-48, 104), p(48, 104)], .5);
  path([p(-48, 65), p(48, 65)], .4);
  const shuttle = Math.sin(time * .85 + station.id) * 17;
  rectangle(shuttle - 24, 71, shuttle + 24, 99, signalColor(warm, .16), .9);
  for (let trace = 0; trace < 5; trace++) {
    path([p(shuttle - 19, 94 - trace * 4.5), p(shuttle - 5 + trace * 3, 94 - trace * 4.5),
      p(shuttle - 5 + trace * 3, 75), p(shuttle + 19, 75)], .42, .65);
  }
  for (let vent = 0; vent < 8; vent++) path([p(-52 + vent * 8, 12), p(-52 + vent * 8, 37)], .34);
  path([p(-63, 43), p(63, 43)], .46);
  const fan = (radius: number, from: number, length: number) => Array.from({ length: 29 }, (_, i) => {
    const angle = from + i / 28 * length;
    return p(44 + Math.cos(angle) * radius, 27 + Math.sin(angle) * radius, front - 1);
  });
  path(fan(15, 0, Math.PI * 2), .35);
  for (let blade = 0; blade < 3; blade++) path(fan(11, -time * 1.3 + blade * Math.PI * 2 / 3, 1.1), .72);

  path([p(55, 176, station.z - 35), p(55, 198, station.z - 35)], .7);
  face([p(51, 196, station.z - 36), p(59, 196, station.z - 36), p(59, 203, station.z - 36), p(51, 203, station.z - 36)], signalColor(warm, .95));
  spatialLabel(ctx, fonts, camera, p(-49, 144, front - 1), 'SMT / 0' + station.id, 13, opacity, signalColor(warm, 1));
  spatialLabel(ctx, fonts, camera, p(-47, 5, front - 1), 'FEED / 128', 6, opacity * .55);

  if (selected && heat > .01) {
    for (let ring = 0; ring < 4; ring++) {
      const loop = Array.from({ length: 37 }, (_, i) => {
        const a = i / 36 * Math.PI * 2;
        return p(25 + Math.cos(a) * (14 + ring * 11), 88 + Math.sin(a) * (10 + ring * 8), front - 1.5);
      });
      path(loop, heat * (.75 - ring * .14), .85);
    }
  }
}

/** Equipment occupies real positions and volumes in the same room as the camera. */
export function drawInspectionField(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  camera: InspectionCamera, time: number, focus: number, heat: number, selectedId = 3) {
  const activeId = inspectionStation(selectedId).id;
  ctx.save();
  for (const station of INSPECTION_STATIONS) {
    const amount = station.id === activeId ? focus : 0;
    const footprint = inspectionFocusPoint({ x: station.x, y: 0, z: station.z }, amount);
    const shadow = Array.from({ length: 33 }, (_, i) => {
      const angle = i / 32 * Math.PI * 2;
      return { x: footprint.x + Math.cos(angle) * (113 + amount * 15), y: 1,
        z: footprint.z + Math.sin(angle) * (125 + amount * 12) };
    });
    fillSpatialPolygon(ctx, camera, shadow, `rgba(0,3,7,${.58 - amount * .13})`);
    if (amount > .001) {
      for (const side of [-1, 1]) {
        const base = { x: station.x + side * 61, y: 1, z: footprint.z - 62 };
        strokeSpatialPath(ctx, camera, [base, { ...base, y: footprint.y }], signalColor(heat, amount * .16));
      }
    }
    const { x, z } = station;
    strokeSpatialPath(ctx, camera, [
      { x: x - 110, y: 2, z: z - 120 }, { x: x + 110, y: 2, z: z - 120 },
      { x: x + 110, y: 2, z: z + 120 }, { x: x - 110, y: 2, z: z + 120 }, { x: x - 110, y: 2, z: z - 120 },
    ], signalColor(station.id === activeId ? heat : 0, .22), 1);
  }
  const ordered = [...INSPECTION_STATIONS].sort((a, b) =>
    inspectionCameraPoint(camera, inspectionFocusPoint({ ...b, y: 88 }, b.id === activeId ? focus : 0)).z
      - inspectionCameraPoint(camera, inspectionFocusPoint({ ...a, y: 88 }, a.id === activeId ? focus : 0)).z);
  ordered.forEach(station => equipment(ctx, fonts, camera, station, time, focus, heat, activeId));

  for (let dust = 0; dust < 45; dust++) {
    const point = projectInspectionPoint(camera, {
      x: -620 + dust * 137 % 1240,
      y: 45 + dust * 67 % 290,
      z: 520 + (dust * 191 + time * 7) % 1900,
    });
    if (!point.visible) continue;
    const size = Math.min(1.4, point.scale * .8);
    ctx.fillStyle = signalColor(0, .14); ctx.fillRect(point.x, point.y, size, size);
  }
  ctx.restore();
}
