import type { VoiceCoreState } from '../jarvisVoiceCore';
import { projectReactorRear, type ProjectedRearFace } from '../reactorRearGeometry';

const METALS = {
  gunmetal: [72, 87, 99], silver: [185, 198, 204], copper: [185, 104, 57],
  recess: [10, 17, 23], cyan: [92, 230, 245],
} as const;

function surfaceColor(face: ProjectedRearFace) {
  const shade = face.material === 'cyan' ? 1 : face.light * (face.role === 'bevel' ? 1.12 : 1);
  return `rgb(${METALS[face.material].map(channel => Math.min(255, Math.round(channel * shade))).join(' ')})`;
}

/** Opaque, depth-sorted mechanical surfaces; scoped canvas state also survives paint errors. */
export function drawReactorRear(ctx: CanvasRenderingContext2D, state: VoiceCoreState, occludedByBody = false) {
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const face of projectReactorRear(state, occludedByBody)) {
      ctx.beginPath();
      face.vertices.forEach((vertex, index) => {
        if (index) ctx.lineTo(vertex.x, vertex.y); else ctx.moveTo(vertex.x, vertex.y);
      });
      ctx.closePath();
      ctx.fillStyle = surfaceColor(face);
      ctx.fill();
    }
  } finally {
    ctx.restore();
  }
}
