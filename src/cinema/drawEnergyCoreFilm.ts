import { DEFAULT_ENERGY_DATA, ENERGY_LAYERS, type EnergyCoreData } from './energyCore';
import { ENERGY_PALETTE, energyBoardState } from './energyDashboard';
import { drawEnergyRing, mixHex } from './components/drawEnergyRing';
import { drawEnergyHudBoard } from './components/drawEnergyHudBoard';
import { drawEnergyInfoBoard } from './components/drawEnergyInfoBoard';
import { drawSevenSegment, withAlpha } from './components/drawHudPanel';
import { DEFAULT_FONTS, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import { smooth } from './filmDrawing';

/**
 * Energy scene: act one is a cyan HUD dashboard (glass panels, gear ring, holographic pedestal),
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
  // scene keeps whatever theme is active. The infographic act only deepens the tint and adds the dot
  // matrix; its violet lives in the panels and ring, never in the page background.
  const backdrop = ctx.createLinearGradient(0, view.top, 0, view.bottom);
  backdrop.addColorStop(0, mixHex('#040b10', hud.line, .04 + state.blend * .03));
  backdrop.addColorStop(1, mixHex('#040b10', hud.line, .11 + state.blend * .05));
  ctx.globalAlpha = state.opacity; ctx.fillStyle = backdrop;
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  ctx.globalAlpha = state.opacity * .12; ctx.strokeStyle = hud.line; ctx.lineWidth = 1;
  for (let x = 72; x <= 1208; x += 56) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 650); ctx.stroke(); }
  for (let y = 60; y <= 650; y += 56) { ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(1208, y); ctx.stroke(); }
  if (state.blend > 0) {
    // Dotted texture of the infographic act, in the accent so it follows the theme too.
    ctx.globalAlpha = state.opacity * state.blend * .35; ctx.fillStyle = hud.line;
    for (let x = 80; x < 1200; x += 24) for (let y = 70; y < 640; y += 24) ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Top readout strip: the three values as segmented digits, coloured per channel.
  const stripAlpha = state.opacity * smooth(.4, 1.6, state.elapsed);
  let cursor = 640 - 170;
  ENERGY_LAYERS.forEach((layer, index) => {
    const value = data[layer.key].value;
    const digits = Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 1, useGrouping: false }) : '--';
    const color = mixHex(hud.channels[index], info.channels[index], state.blend);
    const shown = drawSevenSegment(ctx, digits, cursor, 62, 18, color, stripAlpha, { ghost: .05 });
    ctx.globalAlpha = stripAlpha * .7; ctx.fillStyle = withAlpha(color, .9); ctx.font = `8px ${fonts.mono}`; ctx.textAlign = 'left';
    ctx.fillText(`${layer.label} ${data[layer.key].unit}`, cursor, 92);
    cursor += shown + 44;
  });
  // Act label sits at the bottom-left, clear of the chapter code the film draws at the top-right.
  ctx.globalAlpha = state.opacity * .7; ctx.fillStyle = mixHex(hud.dim, info.dim, state.blend); ctx.font = `11px ${fonts.mono}`; ctx.textAlign = 'left';
  ctx.fillText(state.blend < .5 ? 'ENERGY / HUD DASHBOARD · ACT 1' : 'ENERGY / INFOGRAPHIC · ACT 2', 72, 646);

  drawEnergyHudBoard(ctx, fonts, data, state, time, state.opacity * (1 - state.blend));
  drawEnergyInfoBoard(ctx, fonts, data, state, time, state.opacity * state.blend);
  drawEnergyRing(ctx, fonts, data, state, time);
  ctx.restore();
}
