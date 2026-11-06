import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { DiceFace } from "./RaceArt";
import "./rollingDice.css";

function RollingCube({ player }) {
  return <span className={`race-rolling-die race-rolling-die--${player}`}>
    <span className="race-roll-shadow" />
    <span className="race-die-hop"><span className="race-cube">
      {[1, 2, 3, 4, 5, 6].map(value => <span key={value} className={`race-cube-face race-cube-face--${value}`}><DiceFace value={value} /></span>)}
    </span></span>
  </span>;
}

// Decorative only: no random result, timer, or animation ever enters a die value.
export default function RollingDice({ childName, adultName, round, settling, paused, onReady, onPause }) {
  return <section className={`race-roll${settling ? " race-roll--settling" : ""}${paused ? " race-roll--paused" : ""}`} role="dialog" aria-modal="true" aria-labelledby="race-roll-title" aria-hidden={paused || undefined} inert={paused}>
    <header className="race-roll-header">
      <button className="games-icon" aria-label="К списку игр" onClick={onPause}><BackArrowIcon /></button>
      <span className="race-roll-round">Раунд {round}</span>
      <button className="games-icon" aria-label="Пауза" onClick={onPause}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></button>
    </header>
    <h2 id="race-roll-title">Бросайте кубики!</h2>
    <div className="race-roll-players"><span className="race-roll-player--child">{childName}</span><span className="race-roll-player--adult">{adultName}</span></div>
    <button className="race-roll-stage" aria-label="Остановить анимацию и ввести числа" disabled={settling} onClick={onReady}>
      <span className="race-roll-floor" aria-hidden="true"><span className="race-roll-orbit" /><RollingCube player="child" /><RollingCube player="adult" /></span>
    </button>
    <footer className="race-roll-footer">
      <button className="games-primary race-roll-ready" disabled={settling} autoFocus onClick={onReady}>Кубики брошены</button>
      <p>Нажмите, когда будете готовы ввести числа</p>
    </footer>
  </section>;
}
