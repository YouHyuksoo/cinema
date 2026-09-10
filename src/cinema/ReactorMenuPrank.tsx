'use client';
import { useEffect, useRef } from 'react';
import { chooseShockTarget, shockEnvelope, shockLightning, shockLightningBranches, shockWaitMs, SHOCK_ATTRIBUTE, SHOCK_DURATION_MS, type ShockTarget } from './reactorMenuShock';
import { createFrameLoop, fitCanvasToBox, watchPageVisibility, watchReducedMotion } from './filmMotion';
import styles from './reactorMenuPrank.module.css';

const targets: Record<ShockTarget, string> = {
  globe: '[data-globe-control]', turbine: '[data-turbine-hub]', cube: '[data-cube-control]',
};
const center = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const visible = (node: HTMLElement | null): node is HTMLElement => {
  if (!node || node.hidden || node.closest('[inert]')) return false;
  const r = node.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};

/** One local scheduler; the existing menu renderers own their reactions and command state. */
export function ReactorMenuPrank() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d'), root = node?.closest('main');
    if (!node || !ctx || !root) return;
    let timer = 0, previous: ShockTarget | null = null;
    let victim: HTMLElement | null = null, source: HTMLElement | null = null;
    let started = 0;
    const clear = () => {
      loop.stop();
      victim?.removeAttribute(SHOCK_ATTRIBUTE); source?.removeAttribute(SHOCK_ATTRIBUTE);
      victim = null; source = null;
      node.removeAttribute('data-shock-target');
      ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,node.width,node.height);
    };
    const schedule = (first = false) => {
      clearTimeout(timer);
      if (!motion.reduced && !document.hidden) timer = window.setTimeout(start, first ? 6500 + Math.random() * 3500 : shockWaitMs(Math.random()));
    };
    const draw = (now: number) => {
      if (!visible(victim) || !visible(source) || source.getAttribute('aria-disabled') === 'true' || document.hidden || motion.reduced) {
        clear(); schedule(); return;
      }
      const elapsed = now - started;
      if (elapsed >= SHOCK_DURATION_MS) { clear(); schedule(); return; }
      const width = innerWidth, height = innerHeight;
      fitCanvasToBox(node, ctx, width, height); ctx.clearRect(0,0,width,height);
      const a = center(source), b = center(victim), power = shockEnvelope(elapsed);
      const accent = getComputedStyle(root).getPropertyValue('--film-accent').trim() || '#5fe3ff';
      // One sustained short discharge, then residual arcs on the victim; no full-screen flashes.
      if (elapsed < 800) {
        const points = shockLightning(a,b,elapsed);
        ctx.lineJoin = 'round'; ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.globalAlpha = .65; ctx.strokeStyle = accent; ctx.lineWidth = 1.8; ctx.shadowColor = accent; ctx.shadowBlur = 6; ctx.stroke();
        ctx.globalAlpha = .9; ctx.strokeStyle = '#eafcff'; ctx.lineWidth = .65; ctx.shadowBlur = 1.5; ctx.stroke();
        for (const [index,branch] of shockLightningBranches(points,elapsed).entries()) {
          ctx.strokeStyle = index%2 ? accent : '#e4eeff'; ctx.shadowBlur = 2;
          for(let j=1;j<branch.length;j++) {
            const taper=1-j/branch.length;
            ctx.globalAlpha=(index%2 ? .4 : .72)*(.2+.8*taper);
            ctx.lineWidth=(index%2 ? .42 : .8)*(.3+.7*taper);
            ctx.beginPath();ctx.moveTo(branch[j-1].x,branch[j-1].y);ctx.lineTo(branch[j].x,branch[j].y);ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = power * .75; ctx.strokeStyle = accent; ctx.lineWidth = .65; ctx.shadowColor = accent; ctx.shadowBlur = 4;
      const radius = victim.getBoundingClientRect().width * .5 + 8;
      for (let i=0;i<4;i++) {
        const angle = i * Math.PI / 2 + elapsed * .006;
        const p = { x:b.x + Math.cos(angle)*radius, y:b.y + Math.sin(angle)*radius*.7 };
        const q = { x:b.x + Math.cos(angle+.55)*(radius+10), y:b.y + Math.sin(angle+.55)*(radius+10)*.7 };
        const arc = shockLightning(p,q,elapsed+i*50);
        ctx.beginPath(); arc.forEach((point,j) => j ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y)); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };
    const loop = createFrameLoop(draw);
    const start = () => {
      const reactor = root.querySelector<HTMLElement>('[data-reactor-trigger]');
      if (!visible(reactor) || reactor.getAttribute('aria-disabled') === 'true' || root.querySelector('[data-cube-flight]') || motion.reduced || document.hidden) { schedule(); return; }
      const available = (Object.keys(targets) as ShockTarget[]).filter(key => {
        const target = root.querySelector<HTMLElement>(targets[key]);
        if (!visible(target) || target.getAttribute('aria-expanded') === 'true' || target.matches(':hover,:focus-visible')) return false;
        if (key === 'globe' && target.dataset.phase !== 'closed') return false;
        if (key === 'cube' && root.querySelector('[data-cube-layer]')?.getAttribute('data-twisting') === 'true') return false;
        return true;
      });
      const target = chooseShockTarget(available, previous, Math.random());
      if (!target) { schedule(); return; }
      victim = root.querySelector<HTMLElement>(targets[target]); source = reactor;
      started = performance.now(); previous = target;
      victim?.setAttribute(SHOCK_ATTRIBUTE, String(started)); source.setAttribute(SHOCK_ATTRIBUTE, String(started));
      node.dataset.shockTarget = target; loop.start();
    };
    const cancel = () => { clear(); schedule(); };
    const motion = watchReducedMotion(cancel);
    const unwatch = watchPageVisibility(cancel);
    root.addEventListener('pointerdown', cancel, true); root.addEventListener('keydown', cancel, true);
    schedule(true);
    return () => {
      clearTimeout(timer); clear(); root.removeEventListener('pointerdown', cancel, true); root.removeEventListener('keydown', cancel, true);
      unwatch(); motion.stop();
    };
  }, []);
  return <canvas ref={canvas} className={styles.overlay} data-reactor-menu-prank aria-hidden="true"/>;
}
