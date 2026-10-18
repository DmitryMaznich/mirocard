import "./Diktor.css";

// The app's listen button («диктор»), shared so every mode that plays a spoken
// prompt looks and moves the same. `playing` drives the animation; the caller
// knows when its own audio starts and ends.
export default function Diktor({ playing = false, onClick, label = "Послушать", disabled = false }) {
  return (
    <div className={`diktor-wrap${playing ? " diktor-wrap--playing" : ""}`}>
      <span className="diktor-ripple" />
      <span className="diktor-ripple" />
      <span className="diktor-ripple" />
      <button type="button" className={`diktor${playing ? " diktor--playing" : ""}`} aria-label={label} disabled={disabled} onClick={onClick}>
        <span className="diktor-bar" />
        <span className="diktor-bar" />
        <span className="diktor-bar" />
        <span className="diktor-bar" />
      </button>
    </div>
  );
}
