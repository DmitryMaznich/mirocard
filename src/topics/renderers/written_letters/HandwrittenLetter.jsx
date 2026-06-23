// 4-line propis coordinate system (viewBox 90×120 / 90×132 for descenders):
//
//  y= 6  L1  ──── верхняя зона top      (ascenders / capitals)
//  y=44  L2  ──── рабочая строка top    (x-height)
//  y=82  L3  ──── baseline
//  y=112 L4  ──── нижняя зона bottom    (р, у, ц, щ, з, д, ф)
//
// Letter body: <text fontFamily="Primo"> (browser renders Primo TTF with hinting)
// Entry stroke: thin <path> overlay computed from glyph advance/xMin metrics.

// Glyph metrics from Primo TTF: [advance, xMin, hasDeepDescender]
// Used only to position the entry hook (крючок начальный).
const M = {
  'а': [400,   41], 'б': [300,   41], 'в': [175,   50], 'г': [225,  147],
  'д': [300, -144], 'е': [175,   47], 'ё': [175,   47], 'ж': [650,  -54],
  'з': [175, -269], 'и': [400,   22], 'й': [400,   22], 'к': [300,  -22],
  'л': [400,   20], 'м': [700,   20], 'н': [400,  -22], 'о': [300,   41],
  'п': [400,  -22], 'р': [400, -272], 'с': [175,   47], 'т': [700,  -22],
  'у': [300, -144], 'ф': [600,   28], 'х': [350,  -54], 'ц': [450,   22],
  'ч': [350,  175], 'ш': [700,   22], 'щ': [750,   22], 'ъ': [350,  170],
  'ы': [400,   29], 'ь': [125,   29], 'э': [175,  -54], 'ю': [525,  -22],
  'я': [400,   16],
  // Uppercase
  'А': [600,   28], 'Б': [650,  122], 'В': [538,   22], 'Г': [375,   28],
  'Д': [600,   17], 'Е': [250,   82], 'Ё': [250,   82], 'Ж': [1175, 120],
  'З': [400,   53], 'И': [625,  247], 'Й': [625,  247], 'К': [625,   72],
  'Л': [525,   29], 'М': [825,   29], 'Н': [600,   72], 'О': [450,  103],
  'П': [700,   28], 'Р': [500,   28], 'С': [250,   93], 'Т': [900,   28],
  'У': [525,  253], 'Ф': [550,   28], 'Х': [675,  121], 'Ц': [675,  247],
  'Ч': [325,  -40], 'Ш': [925,  247], 'Щ': [975,  247], 'Ъ': [413,    4],
  'Ы': [775,  253], 'Ь': [538,  253], 'Э': [425,  121], 'Ю': [900,   72],
  'Я': [525,   29],
};

// Letters whose descenders extend below L4 — card gets extra height
const DEEP_DESC = new Set('рзудф');

const VB_W  = 90;
const VB_H  = 120;
const VB_H2 = 132;   // for deep-descender letters

const L1 = 6;
const L2 = 44;
const L3 = 82;
const L4 = 112;

// font-size chosen so Primo x-height ≈ L2–L3 = 38 SVG units
// Primo x-height ≈ 422/1000 em  →  FS = 38/0.422 ≈ 90 ... but Primo renders
// slightly smaller than em metrics; empirically FS=65 fills the zone well.
const FS   = 65;
const TX   = 43;   // text-anchor x (VB_W/2 – 2 to compensate Primo's rightward lean)
const UPM  = 1000;

const C_BG    = "#fefef6";
const C_ZONE  = "rgba(205,232,245,0.45)";
const C_OUTER = "#c5e2f2";
const C_L2    = "#9ecde8";
const C_L3    = "#5bafd0";
const C_FONT  = "#1d4ed8";
const HOOK_SW = 2.2;  // stroke-width of the entry hook

/**
 * Compute the SVG path for the initial entry stroke (крючок начальный).
 * Returns null for letters where no hook data is available.
 */
function hookPath(letter) {
  const m = M[letter];
  if (!m) return null;
  const [adv, xMin] = m;
  const scale = FS / UPM;

  // x-position where the letter's leftmost ink starts in SVG space
  const inkX = TX - (adv / 2 - xMin) * scale;
  // y slightly below baseline (Primo yMin ≈ –21 → 21×0.065 ≈ 1.4 SVG below L3)
  const inkY = L3 + 1.5;

  // Hook starts 8–12 SVG units to the left; never past x=4
  const hw = Math.max(8, Math.min(12, inkX - 4));
  const hx = Math.max(4, inkX - hw);

  // Control point: 40% across, dips 5.5 below baseline
  const cx = hx + hw * 0.4;
  const cy = L3 + 5.5;

  return `M ${hx.toFixed(1)},${L3} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${inkX.toFixed(1)},${inkY.toFixed(1)}`;
}

export default function HandwrittenLetter({ letter, size = 100, className = "" }) {
  const lower = letter.toLowerCase();
  const vbH   = DEEP_DESC.has(lower) ? VB_H2 : VB_H;
  const hook  = hookPath(letter);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${vbH}`}
      width={size}
      height={Math.round(size * vbH / VB_W)}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={VB_W} height={vbH} fill={C_BG} />

      {/* upper zone tint */}
      <rect x={0} y={L1} width={VB_W} height={L2 - L1} fill={C_ZONE} />

      {/* lower zone tint */}
      <rect x={0} y={L3} width={VB_W} height={vbH - L3} fill={C_ZONE} />

      <line x1={0} y1={L1} x2={VB_W} y2={L1} stroke={C_OUTER} strokeWidth={1.0} />
      <line x1={0} y1={L2} x2={VB_W} y2={L2} stroke={C_L2}   strokeWidth={1.4} />
      <line x1={0} y1={L3} x2={VB_W} y2={L3} stroke={C_L3}   strokeWidth={1.8} />
      <line x1={0} y1={L4} x2={VB_W} y2={L4} stroke={C_OUTER} strokeWidth={1.0} />

      {/* letter body rendered by browser from Primo TTF */}
      <text
        x={TX}
        y={L3}
        textAnchor="middle"
        fontFamily="Primo, cursive"
        fontSize={FS}
        fill={C_FONT}
      >
        {letter}
      </text>

      {/* entry hook drawn as a thin stroke-based path */}
      {hook && (
        <path
          d={hook}
          fill="none"
          stroke={C_FONT}
          strokeWidth={HOOK_SW}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
