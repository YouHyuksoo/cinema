/* global Vision, importScripts */

let detector = null;
let surface = null;
let surfaceContext = null;
let initializing = false;

async function initialize() {
  if (initializing || detector) return;
  initializing = true;
  try {
    importScripts('/cinema/vision/vision_bundle.js');
    const files = await Vision.FilesetResolver.forVisionTasks('/cinema/vision');
    detector = await Vision.FaceDetector.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: '/cinema/vision/blaze_face_short_range.tflite',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: .55,
      minSuppressionThreshold: .3,
    });
    surface = new OffscreenCanvas(480, 270);
    surfaceContext = surface.getContext('2d', { willReadFrequently: true });
    if (!surfaceContext) throw new Error('No frame context');
    self.postMessage({ type: 'ready' });
  } catch {
    detector?.close();
    detector = null;
    self.postMessage({ type: 'error', stage: 'load' });
  }
}

self.onmessage = event => {
  const message = event.data;
  if (message.type === 'init') { void initialize(); return; }
  if (message.type !== 'frame') return;
  const { bitmap, timestamp } = message;
  try {
    if (!detector || !surface || !surfaceContext) throw new Error('Detector not ready');
    if (surface.width !== bitmap.width) surface.width = bitmap.width;
    if (surface.height !== bitmap.height) surface.height = bitmap.height;
    surfaceContext.drawImage(bitmap, 0, 0);
    const result = detector.detectForVideo(surface, timestamp);
    const boxes = result.detections.filter(detection => detection.boundingBox).map(detection => {
      const box = detection.boundingBox;
      return {
        x: box.originX / surface.width,
        y: box.originY / surface.height,
        width: box.width / surface.width,
        height: box.height / surface.height,
      };
    });
    self.postMessage({ type: 'result', boxes, timestamp });
  } catch {
    self.postMessage({ type: 'error', stage: 'detect' });
  } finally {
    bitmap?.close();
    // Raw pixels are needed only during inference, never retained between frames.
    surfaceContext?.clearRect(0, 0, surface.width, surface.height);
  }
};
