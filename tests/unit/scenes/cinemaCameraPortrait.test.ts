import { describe, expect, it } from 'vitest';
import { CAMERA_PORTRAIT, cameraPortraitCrop } from '@/cinema/cameraPortrait';

describe('camera portrait framing', () => {
  it.each([[1280, 720], [1920, 1080], [480, 640], [640, 480]])('fits %s by %s video without distortion or leaving its source', (width, height) => {
    for (const zoom of [1, 1.15, 2]) {
      const crop = cameraPortraitCrop(width, height, zoom)!;
      expect(crop.width / crop.height).toBeCloseTo(CAMERA_PORTRAIT.width / CAMERA_PORTRAIT.height);
      expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(width);
      expect(crop.y + crop.height).toBeLessThanOrEqual(height);
      expect(crop.x + crop.width / 2).toBeCloseTo(width / 2);
    }
  });
  it('waits for valid metadata and clamps zoom to a usable crop', () => {
    expect(cameraPortraitCrop(0, 0, 1)).toBeNull();
    expect(cameraPortraitCrop(Infinity, 720, 1)).toBeNull();
    expect(cameraPortraitCrop(1280, 720, 0)).toEqual(cameraPortraitCrop(1280, 720, 1));
    expect(cameraPortraitCrop(1280, 720, 5)).toEqual(cameraPortraitCrop(1280, 720, 2));
  });
  it('centres an off-centre face with extra forehead room', () => {
    const face = { x: .6, y: .3, width: .15, height: .25 };
    const crop = cameraPortraitCrop(1280, 720, 1.15, face)!;
    expect(crop.x + crop.width / 2).toBeCloseTo((face.x + face.width / 2) * 1280);
    expect(crop.y + crop.height / 2).toBeCloseTo((face.y + face.height * .43) * 720);
    expect(crop.width).toBeGreaterThan(face.width * 1280);
    expect(crop.height).toBeGreaterThan(face.height * 720);
  });
  it('keeps tracked crops within the source at all four edges and zoom levels', () => {
    for (const [width, height] of [[1280, 720], [480, 640]]) {
      for (const x of [0, .8]) for (const y of [0, .7]) for (const zoom of [1, 1.15, 2]) {
        const crop = cameraPortraitCrop(width, height, zoom, { x, y, width: .2, height: .3 })!;
        expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(width);
        expect(crop.y + crop.height).toBeLessThanOrEqual(height);
        expect(crop.width / crop.height).toBeCloseTo(CAMERA_PORTRAIT.width / CAMERA_PORTRAIT.height);
      }
    }
  });
  it('uses the centre crop when a detection is invalid', () => {
    for (const face of [{ x: NaN, y: .1, width: .2, height: .3 }, { x: .9, y: .1, width: .2, height: .3 },
      { x: .2, y: .1, width: 0, height: .3 }]) {
      expect(cameraPortraitCrop(1280, 720, 1.15, face)).toEqual(cameraPortraitCrop(1280, 720, 1.15));
    }
  });
});
