// Primo's digit glyphs are not centered within their own advance-width box —
// measured via pixel scan of rendered buttons: ink sits ~13.6% of the button
// size to the RIGHT of true center for every digit 0-9. This nudges it back
// left, scaling with button size so it holds at both phone and tablet sizes.
const DIGIT_INK_OFFSET_RATIO = 0.136;
// Deliberate downward nudge (not a font-metrics fix — an explicit design
// choice): 6px at the 44px phone button size (mid-point of the requested
// 5-7px range), expressed as a ratio of button size so it scales the same
// way at tablet size (1.5x button -> proportionally larger nudge).
const DIGIT_VERTICAL_OFFSET_RATIO = 6 / 44;

// The two digit rows (1-5, then 6-9,0) of the Столбик tap keyboard — pulled
// out so other column_addition tasks needing plain digit entry (Считаем на
// пальцах) get the same hand-written-style buttons instead of rolling their
// own. Callers add whatever extra row they need (sign/line, delete...) below.
export default function DigitKeypad({ onDigit, bs }) {
  const bsStr = bs + "px";
  const digitFS = Math.round(bs * 0.8) + "px";
  const digitStyle = { width: bsStr, height: bsStr, fontSize: digitFS };
  const digitSlantStyle = {
    transform: `translateX(-${Math.round(bs * DIGIT_INK_OFFSET_RATIO)}px) translateY(${Math.round(bs * DIGIT_VERTICAL_OFFSET_RATIO)}px)`,
  };

  return (
    <>
      <div className="col-tap-row">
        {[1, 2, 3, 4, 5].map((d) => (
          <button key={d} className="col-tap-btn" style={digitStyle} onClick={() => onDigit(d)}>
            <span className="col-slant" style={digitSlantStyle}>{d}</span>
          </button>
        ))}
      </div>
      <div className="col-tap-row">
        {[6, 7, 8, 9, 0].map((d) => (
          <button key={d} className="col-tap-btn" style={digitStyle} onClick={() => onDigit(d)}>
            <span className="col-slant" style={digitSlantStyle}>{d}</span>
          </button>
        ))}
      </div>
    </>
  );
}
