import type { CSSProperties } from 'react';
import type { CenterBackground } from './jarvisCenterBackground';
import { CyanPanelBackdrop } from './CyanPanelBackdrop';
import { JarvisCenterBackdrop } from './JarvisCenterBackdrop';
import styles from './centerTemplateBackdrop.module.css';

const palettes = {
  'steel-orbit': ['#a5dfff', '#071725'],
  'crimson-core': ['#ff4c55', '#21070d'],
  'cyan-hex': ['#00f0ea', '#031b22'],
  'blue-diamond': ['#54caff', '#061a2d'],
  'amber-orbit': ['#ff8e36', '#1c1009'],
} as const;

function Dial({ x, y, r }: { x: number; y: number; r: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r={r} opacity=".25" />
    <circle r={r - 7} strokeWidth="4" strokeDasharray="18 5 3 5" />
    <circle r={r - 15} strokeDasharray="1 4" strokeWidth="3" opacity=".65" />
    <circle r={r - 22} opacity=".5" />
    <path d="M-8 0H8M0-8V8" opacity=".35" />
  </g>;
}

/** The gallery and live surface share these original, text-free vector templates. */
export function CenterTemplateBackdrop({ background }: { background: CenterBackground }) {
  if (background === 'classic') return null;
  if (background === 'neon-hud') return <JarvisCenterBackdrop />;
  if (background === 'cyan-panel') return <CyanPanelBackdrop />;
  const [accent, base] = palettes[background];
  const hex = background === 'cyan-hex';
  const diamond = background === 'blue-diamond';
  const amber = background === 'amber-orbit';
  const red = background === 'crimson-core';
  return <svg className={styles.panel} style={{ '--template-accent': accent, '--template-base': base } as CSSProperties}
    viewBox="0 0 800 400" preserveAspectRatio="none" fill="none" stroke="currentColor"
    aria-hidden="true" focusable="false" data-center-backdrop={background}>
    <path className={styles.base} d="M0 0H800V400H0Z" stroke="none" />
    <g opacity=".08" strokeWidth=".6">
      {Array.from({ length: 26 }, (_, i) => <path key={i} d={`M${i * 32} 0v400M0 ${i * 32}h800`} />)}
    </g>
    <g opacity=".55">
      <path d="M12 75V32L34 12H230l22 18h296l22-18h196l22 20v43M12 325v43l22 20h196l22-18h296l22 18h196l22-20v-43" strokeWidth="2" />
      <path d="M24 73V39l15-15h173M588 24h173l15 15v34M24 327v34l15 15h173M588 376h173l15-15v-34" strokeWidth="4" />
      <path d="M270 18h260M270 382h260" strokeWidth="5" strokeDasharray="2 6" />
    </g>
    {hex ? <>
      <g transform="translate(400 200)">
        {[1.2, 1, .88, .69].map((s, i) => <path key={s} transform={`scale(${s})`} d="M-145 0-73-125H73L145 0 73 125H-73Z" strokeWidth={i === 1 ? 5 : 1.5} opacity={i === 0 ? .2 : .85} />)}
        <path d="M-62-109H62M126-1 63 108H-62M-126 0-65-106" strokeWidth="9" strokeDasharray="32 8" />
      </g>
      <path d="M20 178h180l47-70M553 108l47 70h180M20 222h180l47 70M553 292l47-70h180" strokeWidth="4" />
      <Dial x={690} y={85} r={49} /><Dial x={110} y={315} r={49} />
      <path d="M64 153v-38m18 38V95m18 58v-22m18 22v-49M643 307h97m-97 11h70m-70 11h88" strokeWidth="7" />
    </> : diamond ? <>
      <g transform="translate(400 200)">
        {[178, 153, 137, 110].map((r, i) => <path key={r} d={`M0 ${-r} ${r} 0 0 ${r} ${-r} 0Z`} strokeWidth={i === 1 ? 5 : 1} opacity={i === 0 ? .25 : .8} />)}
        <path d="M-138-12-12-138M12 138 138 12" strokeWidth="9" strokeDasharray="3 6" />
        <circle r="73" opacity=".3" /><circle r="61" strokeDasharray="40 12" strokeWidth="2" />
      </g>
      <path d="M20 153h152l46 47-46 47H20M780 153H628l-46 47 46 47h152" strokeWidth="2" />
      <path d="M38 176h116M38 187h90M646 213h116M672 224h90" strokeWidth="4" strokeDasharray="3 5" />
      <Dial x={112} y={87} r={47} /><Dial x={688} y={313} r={47} />
    </> : amber ? <>
      <path d="M16 54 249 88 496 53M16 346l233-34 247 35M30 200h240l70-50h122" strokeWidth="2" opacity=".6" />
      <g transform="translate(400 200)">
        <ellipse rx="268" ry="119" transform="rotate(-21)" opacity=".45" />
        <ellipse rx="250" ry="134" transform="rotate(18)" strokeDasharray="90 20 2 12" opacity=".35" />
        <circle r="165" strokeDasharray="190 45 55 20" strokeWidth="6" />
        <circle r="151" strokeDasharray="2 6" strokeWidth="6" opacity=".6" />
        <circle r="130" strokeWidth="2" /><circle r="116" strokeDasharray="140 30" strokeWidth="7" opacity=".7" />
      </g>
      <Dial x={162} y={247} r={68} /><Dial x={737} y={66} r={48} />
      <path d="M30 86h114m-114 12h82m-82 12h98M38 358h180" strokeDasharray="12 4" strokeWidth="3" />
    </> : <>
      <g transform="translate(400 200)">
        <circle r="170" opacity=".2" strokeWidth="2" />
        <circle r="156" strokeWidth={red ? 8 : 3} strokeDasharray={red ? '90 8 8 8' : '180 32'} />
        <circle r="142" strokeWidth="8" strokeDasharray="2 6" opacity=".6" />
        <circle r="122" strokeWidth="2" /><circle r="109" strokeWidth="5" strokeDasharray="130 24 30 24" />
        <circle r="93" opacity=".3" />
        {red ? <path d="M0-74 64-37V37L0 74-64 37V-37Z" opacity=".65" /> : <circle r="82" strokeDasharray="3 16" strokeWidth="4" />}
      </g>
      <path d={red ? 'M24 48h170l94 82M776 48H606l-94 82M24 352h170l94-82M776 352H606l-94-82' : 'M22 42h119l145 102M778 42H659L514 144M22 358h119l145-102M778 358H659L514 256'} strokeWidth={red ? 5 : 3} opacity=".7" />
      <path d="M24 181h176M24 219h176M600 181h176M600 219h176" strokeWidth="5" strokeDasharray={red ? '5 7' : '24 5'} opacity=".7" />
      <Dial x={100} y={red ? 289 : 103} r={46} /><Dial x={700} y={red ? 111 : 297} r={46} />
      <path d="M28 260h135m-135 10h102M637 130h135m-102 10h102" opacity=".35" />
    </>}
  </svg>;
}
