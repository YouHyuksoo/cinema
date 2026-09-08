import type { FaceBox } from './faceTracking';

export const CAMERA_PORTRAIT = { x: 640, y: 347, width: 530, height: 620 };

/** Keep the detected face centred, with room above its bounding box for the forehead. */
export function cameraPortraitCrop(sourceWidth: number, sourceHeight: number, zoom: number, face?: FaceBox | null) {
  if (!(sourceWidth > 0 && sourceHeight > 0) || !Number.isFinite(sourceWidth + sourceHeight)) return null;
  const magnification = Number.isFinite(zoom) ? Math.max(1, Math.min(2, zoom)) : 1;
  const aspect = CAMERA_PORTRAIT.width / CAMERA_PORTRAIT.height;
  const validFace = face && Object.values(face).every(Number.isFinite)
    && face.width > 0 && face.height > 0 && face.x >= 0 && face.y >= 0
    && face.x + face.width <= 1.001 && face.y + face.height <= 1.001 ? face : null;
  const availableWidth = Math.min(sourceWidth, sourceHeight * aspect);
  const framingWidth = validFace ? Math.max(validFace.width * sourceWidth * 1.85,
    validFace.height * sourceHeight * 1.8 * aspect) : availableWidth;
  const width = Math.min(availableWidth, framingWidth / magnification);
  const height = Math.min(sourceHeight, width / aspect);
  const centerX = validFace ? (validFace.x + validFace.width / 2) * sourceWidth : sourceWidth / 2;
  const centerY = validFace ? (validFace.y + validFace.height * .43) * sourceHeight : height / 2 + (sourceHeight - height) * .45;
  return {
    x: Math.max(0, Math.min(sourceWidth - width, centerX - width / 2)),
    y: Math.max(0, Math.min(sourceHeight - height, centerY - height / 2)), width, height,
  };
}
