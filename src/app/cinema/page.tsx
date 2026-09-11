import { SignalFilm } from '@/cinema/SignalFilm';
import { HatcheryIntro } from '@/cinema/HatcheryIntro';

export default function CinemaPage() {
  return <>
    {/* Critical first-paint guard: keep the HUD mounted and measurable behind the intro. */}
    <style>{`html:not([data-hatchery-intro-seen]) [data-intro-stage][data-online="false"] ~ main[data-film-theme] { opacity: 0; pointer-events: none; }`}</style>
    <HatcheryIntro />
    <SignalFilm />
  </>;
}
