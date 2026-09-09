import { voiceCoreCanvasTransform } from './jarvisVoiceCore';

/** Percentages stay in the canvas's local box even when an ancestor scales the entire HUD. */
export function reactorTriggerStyle(displayWidth: number, displayHeight: number) {
  const width = Number.isFinite(displayWidth) ? Math.max(1, displayWidth) : 1;
  const height = Number.isFinite(displayHeight) ? Math.max(1, displayHeight) : 1;
  const fit = voiceCoreCanvasTransform(width, height);
  const size = Math.max(44, 224 * fit.scale);
  return {
    width: `${size / width * 100}%`, height: `${size / height * 100}%`,
    left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
  };
}
