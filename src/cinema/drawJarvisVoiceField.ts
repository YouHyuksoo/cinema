import type { JarvisAudioFrame } from './jarvisAudio';
import { voiceCoreState } from './jarvisVoiceCore';
import { voiceTeslaSparks } from './voiceReactorGeometry';
import { drawArcReactor, drawReactorShadow, drawTeslaDischarge } from './components/drawVoiceReactor';
import { reactorEasterEggPose, reactorPerchedShip, type ReactorEasterEggFrame } from './reactorEasterEgg';
import { drawReactorImpact, drawReactorLaser, drawReactorShip } from './components/drawReactorEasterEgg';

interface VoiceFieldInput {
  time: number; phase: JarvisAudioFrame['phase']; level: number; reduced?: boolean; egg?: ReactorEasterEggFrame | null;
}

/** A rotating solid arc reactor with audio-driven discharges between core and coils. */
export function drawJarvisVoiceField(ctx: CanvasRenderingContext2D, input: VoiceFieldInput) {
  let egg = input.egg ?? null;
  const state = reactorEasterEggPose(voiceCoreState(input.time, input.phase, input.level, input.reduced), egg);
  if (egg) egg = reactorPerchedShip(state, egg);
  ctx.save();
  drawReactorShadow(ctx);
  if (egg) {
    if (egg.behind) drawReactorShip(ctx, egg);
    drawReactorLaser(ctx, state, egg); drawReactorImpact(ctx, egg);
  }
  drawArcReactor(ctx, state);
  for (const spark of voiceTeslaSparks(state)) drawTeslaDischarge(ctx, spark, state.pitch);
  if (egg && !egg.behind) drawReactorShip(ctx, egg);
  ctx.restore();
}
