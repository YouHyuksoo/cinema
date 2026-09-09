import type { ReactNode } from 'react';
import styles from './film.module.css';

/**
 * Shared dock form fields. Every playback/texture/chart/camera control used to hand-roll the same
 * `<label><span/>…</label>` pair; keeping them here keeps markup, focus styling and value readouts
 * consistent across the dock (DESIGN.md · 도크 공용 필드 항목).
 */

export interface SelectOption<T extends string> { value: T; label: string }

export function SelectField<T extends string>({ label, value, options, disabled, ariaLabel, onChange }: {
  label: string; value: T; options: readonly SelectOption<T>[]; disabled?: boolean; ariaLabel?: string;
  onChange: (value: T) => void;
}) {
  return (
    <label className={styles.speedControl}>
      <span>{label}</span>
      <select value={value} disabled={disabled} aria-label={ariaLabel}
        onChange={event => onChange(event.target.value as T)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function RangeField({ label, value, min, max, step, disabled, ariaLabel, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; disabled?: boolean; ariaLabel?: string;
  /** Readout beside the slider; `—` is the convention for a slider whose value is currently moot. */
  display: ReactNode;
  onChange: (value: number) => void;
}) {
  const text = typeof display === 'string' ? display : undefined;
  return (
    <label className={styles.textureIntensity}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        aria-label={ariaLabel} aria-valuetext={text} onChange={event => onChange(Number(event.target.value))} />
      <span className={styles.textureValue} aria-hidden="true">{display}</span>
    </label>
  );
}

/** Slider bound to a 0–1 ratio but shown and stepped as whole percent. */
export function PercentField({ value, step = 5, disabled, moot, ...rest }: {
  label: string; value: number; min?: number; max?: number; step?: number; disabled?: boolean; ariaLabel?: string;
  /** When true the slider is disabled and reads `—` (e.g. depth for a flat chart, intensity for no texture). */
  moot?: boolean;
  onChange: (ratio: number) => void;
}) {
  const percent = Math.round(value * 100);
  const { min = 0, max = 1, onChange, ...fields } = rest;
  return <RangeField {...fields} value={percent} min={Math.round(min * 100)} max={Math.round(max * 100)} step={step}
    disabled={disabled || moot} display={moot ? '—' : `${percent}%`} onChange={next => onChange(next / 100)} />;
}
