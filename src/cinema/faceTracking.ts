/** Coordinates in the original, unmirrored video, normalized to 0..1. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceTrackingReading {
  status: 'tracking' | 'searching';
  face: FaceBox | null;
}

const LOST_FACE_HOLD_MS = 900;

function validFaceBox(box: FaceBox): FaceBox | null {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)
    || box.width <= 0 || box.height <= 0) return null;
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const right = Math.min(1, box.x + box.width);
  const bottom = Math.min(1, box.y + box.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function centerDistance(a: FaceBox, b: FaceBox) {
  return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2,
    a.y + a.height / 2 - b.y - b.height / 2);
}

/** Retains one subject and eases detector jitter; it never identifies a person. */
export function createFaceTrackingFilter() {
  let face: FaceBox | null = null;
  let lastSeen = -Infinity;
  let lastUpdate = -Infinity;

  return {
    update(boxes: readonly FaceBox[], timestamp: number): FaceTrackingReading {
      const time = Number.isFinite(timestamp) ? Math.max(timestamp, lastUpdate)
        : Number.isFinite(lastUpdate) ? lastUpdate : 0;
      const candidates = boxes.map(validFaceBox).filter((box): box is FaceBox => box !== null);
      if (time - lastSeen > LOST_FACE_HOLD_MS) face = null;
      const previous = face;
      const selected = previous
        ? candidates.filter(box => centerDistance(box, previous) < Math.max(.28, previous.width))
          .sort((a, b) => centerDistance(a, previous) - centerDistance(b, previous))[0]
        : candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];

      if (selected) {
        const amount = previous ? 1 - Math.exp(-Math.min(250, Math.max(0, time - lastUpdate)) / 180) : 1;
        face = previous ? {
          x: previous.x + (selected.x - previous.x) * amount,
          y: previous.y + (selected.y - previous.y) * amount,
          width: previous.width + (selected.width - previous.width) * amount,
          height: previous.height + (selected.height - previous.height) * amount,
        } : selected;
        lastSeen = time;
      }
      lastUpdate = time;
      return { status: face ? 'tracking' : 'searching', face };
    },
  };
}
