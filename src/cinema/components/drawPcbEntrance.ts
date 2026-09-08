import { signalColor } from '../filmDrawing';
import type { PcbEntranceState } from '../pcbEntrance';
import type { PcbInspectionData } from '../pcbInspectionData';
import type { PcbInspectionLayout, PcbInspectionProjection } from '../pcbInspectionLayout';
import { phonePath } from './phoneDrawing';

/** Ground-plane light, circuit ignition particles and the final lock halo. */
export function drawPcbEntrance(ctx: CanvasRenderingContext2D, layout: PcbInspectionLayout,
  projection: PcbInspectionProjection, data: PcbInspectionData, entrance: PcbEntranceState) {
  const { project, boardTop } = projection;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const floorZ = boardTop + Math.max(5, data.thickness * 3);

  if (entrance.ground > 0) {
    ctx.globalAlpha *= entrance.ground;
    // A projected world-space grid and rings read as a low horizontal light table.
    for (let row = -3; row <= 3; row++) {
      const y = row / 3 * data.height * .68;
      phonePath(ctx, project, [{ x: -data.width * .62, y, z: floorZ }, { x: data.width * .62, y, z: floorZ }]);
      ctx.strokeStyle = signalColor(0, row ? .08 : .18); ctx.lineWidth = row ? .45 : .8; ctx.stroke();
    }
    for (let column = -4; column <= 4; column++) {
      const x = column / 4 * data.width * .62;
      phonePath(ctx, project, [{ x, y: -data.height * .68, z: floorZ }, { x, y: data.height * .68, z: floorZ }]);
      ctx.strokeStyle = signalColor(0, column ? .07 : .16); ctx.lineWidth = column ? .4 : .75; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 3; ring++) {
      const wave = Math.max(0, Math.min(1, entrance.time / 1.5 - ring * .18));
      if (!wave) continue;
      const points = Array.from({ length: 49 }, (_, index) => {
        const angle = index / 48 * Math.PI * 2, radius = (.25 + wave * .58) * (ring + 2) / 4;
        return { x: Math.cos(angle) * data.width * radius, y: Math.sin(angle) * data.height * radius, z: floorZ };
      });
      phonePath(ctx, project, points, true); ctx.strokeStyle = signalColor(0, (1 - wave) * .26 + .05);
      ctx.lineWidth = 1.1; ctx.shadowColor = signalColor(0, .35); ctx.shadowBlur = 8; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  }

  if (entrance.particles > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = entrance.particles;
    for (let index = 0; index < 22; index++) {
      const along = ((index * 37) % 101) / 100;
      const across = ((index * 61) % 97) / 96;
      const drift = Math.sin(entrance.time * 2.2 + index * 1.7) * 2.4;
      const point = project({ x: (along - .5) * data.width * .92, y: (across - .5) * data.height * .86,
        z: boardTop - 2.2 - drift });
      ctx.beginPath(); ctx.arc(point.x, point.y, index % 4 ? 1.1 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = index % 5 ? signalColor(0, .62) : signalColor(1, .72); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  if (entrance.lock > 0) {
    const margin = 5 + (1 - entrance.lock) * 18;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => project({
      x: x * (data.width / 2 + margin), y: y * (data.height / 2 + margin), z: boardTop - .5,
    }));
    ctx.beginPath(); corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
    ctx.globalAlpha = entrance.lock * entrance.pulse; ctx.strokeStyle = signalColor(0, .62); ctx.lineWidth = 1.2;
    ctx.shadowColor = signalColor(0, .55); ctx.shadowBlur = 10; ctx.stroke();
    const center = project({ x: 0, y: 0, z: boardTop - .6 });
    ctx.beginPath(); ctx.arc(center.x, center.y, Math.min(layout.board.width, layout.board.height) * .055, 0, Math.PI * 2);
    ctx.strokeStyle = signalColor(0, .2); ctx.lineWidth = .7; ctx.stroke();
  }
  ctx.restore();
}
