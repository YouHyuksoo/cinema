import { DEFAULT_ENERGY_DATA, ENERGY_LAYERS, type EnergyCoreData } from './energyCore';
import { ENERGY_PALETTE, energyBoardState } from './energyDashboard';
import { drawEnergyRing, mixHex } from './components/drawEnergyRing';
import { drawEnergyHudBoard } from './components/drawEnergyHudBoard';
import { drawEnergyInfoBoard } from './components/drawEnergyInfoBoard';
import { withAlpha } from './components/drawHudPanel';
import { drawEnergyValue } from './components/drawEnergyValue';
import { DEFAULT_FONTS, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import { smooth } from './filmDrawing';

/**
 * Energy scene: act one is a cyan HUD dashboard (glass panels and suspended energy ring),
 * act two a violet infographic (wedge ring, dot matrix, checks, waves). The ring stays in place
 * and morphs across the cut at ENERGY_BOARD_SWITCH; both acts read the same energy data.
 */
export function drawEnergyCoreFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: EnergyCoreData = DEFAULT_ENERGY_DATA) {
  const state = energyBoardState(time);
  const view = beginFilmViewport(ctx, width, height, insets);
  const hud = ENERGY_PALETTE.hud, info = ENERGY_PALETTE.infographic;
  ctx.save();
  ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.lineCap = 'butt'; ctx.textBaseline = 'alphabetic';
  // Every scene starts from the film's opaque base so nothing from the previous chapter bleeds through.
  ctx.globalAlpha = 1; ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  // Backdrop: the film's dark base tinted by the HUD accent (which the theme mapper recolors), so the
  // scene keeps the active theme without introducing a grid or dotted background.
  const backdrop = ctx.createLinearGradient(0, view.top, 0, view.bottom);
  backdrop.addColorStop(0, mixHex('#040b10', hud.line, .04 + state.blend * .03));
  backdrop.addColorStop(1, mixHex('#040b10', hud.line, .11 + state.blend * .05));
  ctx.globalAlpha = state.opacity; ctx.fillStyle = backdrop;
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  // Top readout strip: the three values as plain numeric labels, coloured per channel.
  const stripAlpha = state.opacity * smooth(.4, 1.6, state.elapsed);
  let cursor = 640 - 170;
  ENERGY_LAYERS.forEach((layer, index) => {
    const value = data[layer.key].value;
    const digits = Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1, useGrouping: false }) : '--';
    const color = mixHex(hud.channels[index], info.channels[index], state.blend);
    const shown = drawEnergyValue(ctx, fonts, digits, cursor, 62, 18, color, stripAlpha, {});
    ctx.globalAlpha = stripAlpha * .7; ctx.fillStyle = withAlpha(color, .9); ctx.font = `8px ${fonts.label}`; ctx.textAlign = 'left';
    ctx.fillText(`${layer.label} ${data[layer.key].unit}`, cursor, 92);
    cursor += shown + 44;
  });
  // Act label sits at the bottom-left, clear of the chapter code the film draws at the top-right.
  ctx.globalAlpha = state.opacity * .7; ctx.fillStyle = mixHex(hud.dim, info.dim, state.blend); ctx.font = `11px ${fonts.label}`; ctx.textAlign = 'left';
  ctx.fillText(state.blend < .5 ? 'ENERGY / HUD DASHBOARD · ACT 1' : 'ENERGY / INFOGRAPHIC · ACT 2', 72, 646);

  drawEnergyHudBoard(ctx, fonts, data, state, time, state.opacity * (1 - state.blend));
  drawEnergyInfoBoard(ctx, fonts, data, state, time, state.opacity * state.blend);
  drawEnergyRing(ctx, fonts, data, state, time);
  ctx.restore();
}
