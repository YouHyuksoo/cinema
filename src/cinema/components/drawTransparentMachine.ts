import { DEFAULT_FONTS, type FilmFonts } from '../filmDrawing';
import { machineDrawOrder, machineLayerPoint, machineProjection,
  type TransparentMachineData, type TransparentMachineState } from '../transparentMachine';
import { drawPhoneBattery, drawPhoneCameraModule, drawPhoneCircuitBoard } from './drawPhoneCircuitBoard';
import { drawPhoneDisplay } from './drawPhoneDisplay';
import { drawPhoneShell } from './drawPhoneShell';
import type { PhoneProject } from './phoneDrawing';

/** Five solid, independently detachable components, rendered in their actual depth order. */
export function drawTransparentMachine(ctx: CanvasRenderingContext2D, state: TransparentMachineState,
  _data: TransparentMachineData, fonts: FilmFonts = DEFAULT_FONTS) {
  const project = machineProjection(state);
  const layers = machineDrawOrder(state);
  ctx.save(); ctx.globalAlpha = state.presence;
  for (const layer of layers) {
    const local: PhoneProject = point => project(machineLayerPoint(layer, point, state));
    const focus = state.selected === layer ? state.focus : 0;
    ctx.save();
    if (layer === 'shell') drawPhoneShell(ctx, local, fonts);
    else if (layer === 'camera') drawPhoneCameraModule(ctx, local, fonts, state.time, focus);
    else if (layer === 'board') drawPhoneCircuitBoard(ctx, local, fonts, state.time, focus);
    else if (layer === 'battery') drawPhoneBattery(ctx, local, fonts, state.time, focus);
    else drawPhoneDisplay(ctx, local, fonts, state.time, focus, state.openings.display);
    ctx.restore();
  }
  ctx.restore();
  return project;
}
