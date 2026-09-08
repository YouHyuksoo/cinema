import type { FilmFonts } from '../filmDrawing';
import {
  fillSpatialPolygon, projectInspectionPoint, spatialLabel, strokeSpatialPath,
  type InspectionCamera, type Point3D,
} from '../inspectionSpace';

const point = (x: number, y: number, z: number): Point3D => ({ x, y, z });
const tint = (alpha: number) => `rgba(102,192,210,${alpha})`;

function roomSurface(ctx: CanvasRenderingContext2D, camera: InspectionCamera,
  corners: readonly Point3D[], color: string) {
  fillSpatialPolygon(ctx, camera, corners, color);
}

/** Fixed world geometry makes the room, equipment and tracking share one perspective. */
export function drawInspectionRoom(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  camera: InspectionCamera, time: number) {
  ctx.save();
  // Keep every surface behind the camera as well: tall views must see room, not its front edge.
  const front = -2400, far = 3000, wall = 720, ceiling = 420;
  const depthFade = (z: number) => Math.max(.17, Math.min(1, 1 - (z - camera.z) / 3650));

  roomSurface(ctx, camera, [point(-wall, 0, far), point(wall, 0, far),
    point(wall, ceiling, far), point(-wall, ceiling, far)], '#112630');
  roomSurface(ctx, camera, [point(-wall, 0, front), point(-wall, 0, far),
    point(-wall, ceiling, far), point(-wall, ceiling, front)], '#10242d');
  roomSurface(ctx, camera, [point(wall, 0, far), point(wall, 0, front),
    point(wall, ceiling, front), point(wall, ceiling, far)], '#10232c');
  roomSurface(ctx, camera, [point(-wall, ceiling, front), point(-wall, ceiling, far),
    point(wall, ceiling, far), point(wall, ceiling, front)], '#10232c');
  roomSurface(ctx, camera, [point(-wall, 0, front), point(wall, 0, front),
    point(wall, 0, far), point(-wall, 0, far)], '#12262d');

  // Gradual tonal changes sit on the floor itself, so they also follow camera movement.
  for (let z = far - 150; z >= front; z -= 150) {
    const alpha = .025 + .06 * depthFade(z);
    roomSurface(ctx, camera, [point(-wall, .1, z), point(wall, .1, z),
      point(wall, .1, z + 150), point(-wall, .1, z + 150)], `rgba(0,9,17,${alpha})`);
  }
  roomSurface(ctx, camera, [point(-110, .2, front), point(110, .2, front),
    point(110, .2, far), point(-110, .2, far)], 'rgba(106,174,183,.025)');

  // The far door and framing provide a stable scale reference behind the production line.
  roomSurface(ctx, camera, [point(-130, 0, far - 1), point(130, 0, far - 1),
    point(130, 310, far - 1), point(-130, 310, far - 1)], '#10242d');
  strokeSpatialPath(ctx, camera, [point(-143, 0, far - 2), point(-143, 323, far - 2),
    point(143, 323, far - 2), point(143, 0, far - 2)], tint(.3), 1.2);
  strokeSpatialPath(ctx, camera, [point(0, 0, far - 2), point(0, 303, far - 2)], tint(.13));
  spatialLabel(ctx, fonts, camera, point(-115, 359, far - 3), 'ASSEMBLY 01', 34, .55);
  for (const side of [-1, 1]) {
    for (let panel = 0; panel < 3; panel++) {
      const x = side * (265 + panel * 137);
      strokeSpatialPath(ctx, camera, [point(x, 24, far - 2), point(x, 355, far - 2)], tint(.12));
    }
  }

  for (let x = -720; x <= 720; x += 90) {
    strokeSpatialPath(ctx, camera, [point(x, .3, front), point(x, .3, far)], tint(.08), .7);
  }
  for (let z = front; z <= far; z += 150) {
    strokeSpatialPath(ctx, camera, [point(-wall, .3, z), point(wall, .3, z)],
      tint(.025 + depthFade(z) * .09), .75);
  }
  for (const side of [-1, 1]) {
    for (const x of [114, 125]) {
      strokeSpatialPath(ctx, camera, [point(side * x, .5, front), point(side * x, .5, far)],
        tint(x === 114 ? .24 : .07), x === 114 ? 1.2 : .8);
    }
    strokeSpatialPath(ctx, camera, [point(side * 660, 2, front), point(side * 660, 2, far)], tint(.12));
    strokeSpatialPath(ctx, camera, [point(side * 717, 215, front), point(side * 717, 215, far)], tint(.08));
    strokeSpatialPath(ctx, camera, [point(side * 460, ceiling - 1, front),
      point(side * 460, ceiling - 1, far)], tint(.17));
  }

  // Repeated ribs and light strips shrink with distance; near ribs have no opaque faces.
  for (let z = 2850; z >= front + 150; z -= 300) {
    const fade = depthFade(z);
    for (const side of [-1, 1]) {
      const x = side * 716;
      strokeSpatialPath(ctx, camera, [point(x, 0, z), point(x, ceiling, z),
        point(side * 595, ceiling, z)], tint(.08 + fade * .17), 1.3);
      strokeSpatialPath(ctx, camera, [point(side * 700, 0, z + 18),
        point(side * 700, ceiling - 16, z + 18)], tint(.07 + fade * .09), .7);
      strokeSpatialPath(ctx, camera, [point(side * 714, 52, z),
        point(side * 714, 52, z + 210)], tint(.08 + fade * .11));
    }
    strokeSpatialPath(ctx, camera, [point(-716, ceiling - 5, z),
      point(716, ceiling - 5, z)], tint(.10 + fade * .12), 1.1);
    strokeSpatialPath(ctx, camera, [point(-716, ceiling - 19, z + 12),
      point(716, ceiling - 19, z + 12)], tint(.06 + fade * .08), .6);

    for (const side of [-1, 1]) {
      const x = side * 365;
      const light = .38 + fade * .25 + Math.sin(time * .4 + z) * .015;
      roomSurface(ctx, camera, [point(x - 10, ceiling - 20, z + 35),
        point(x + 10, ceiling - 20, z + 35), point(x + 10, ceiling - 20, z + 224),
        point(x - 10, ceiling - 20, z + 224)], `rgba(155,223,230,${light})`);
      strokeSpatialPath(ctx, camera, [point(x, ceiling - 21, z + 35),
        point(x, ceiling - 21, z + 224)], `rgba(198,244,246,${light})`, 1.3);
      // A wide, faint floor reflection stays on its corresponding world-space bay.
      roomSurface(ctx, camera, [point(x - 35, .6, z + 35), point(x + 35, .6, z + 35),
        point(x + 35, .6, z + 224), point(x - 35, .6, z + 224)], tint(.022 * fade));
    }
  }

  // Floating motes carry additional parallax without turning the room into a star field.
  for (let i = 0; i < 24; i++) {
    const z = 570 + (i * 173) % 2250;
    const screen = projectInspectionPoint(camera, point(-570 + (i * 193) % 1140,
      90 + (i * 71) % 260 + Math.sin(time * .18 + i) * 4, z));
    if (!screen.visible) continue;
    const size = Math.min(1.5, Math.max(.45, screen.scale * .9));
    ctx.fillStyle = tint(.11 * depthFade(z));
    ctx.fillRect(screen.x, screen.y, size, size);
  }
  ctx.restore();
}
