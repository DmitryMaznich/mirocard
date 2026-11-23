import {
  LOGO_VIEWBOX, LOGO_TRANSLATE, LOGO_MARK_PATH, LOGO_WORD_PATH, LOGO_U_PATH, LOGO_INK, LOGO_GOLD,
} from "@/shared/brand/mironiumLogo.js";

// The Mironium logo (public/brand/mironium-logo.svg), inlined in outlines so a print never waits for a font.
export default function MironiumLogo({ className = "" }) {
  return (
    <svg className={className} viewBox={LOGO_VIEWBOX} role="img" aria-label="Mironium">
      <g transform={LOGO_TRANSLATE}>
        <path fill={LOGO_INK} d={LOGO_MARK_PATH} />
        <path fill={LOGO_INK} d={LOGO_WORD_PATH} />
        <path fill={LOGO_GOLD} d={LOGO_U_PATH} />
      </g>
    </svg>
  );
}
