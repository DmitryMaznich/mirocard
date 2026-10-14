import { MIRONIUM_HEAD } from "@/topics/renderers/propis/brandMarks.jsx";

// The Mironium logo (public/brand/mironium-logo.svg: the head and the word, the «u» in gold), inlined so a print never waits for it.
export default function MironiumLogo({ className = "" }) {
  return (
    <svg className={className} viewBox="0 15 320 60" fill="none" role="img" aria-label="Mironium">
      <g transform="translate(2 19) scale(.115)"><path d={MIRONIUM_HEAD} fill="#1C3634" /></g>
      <text x="57" y="64" fill="#1C3634" fontFamily="'DM Serif Display', Georgia, serif" fontSize="54" letterSpacing="-3">Mironi<tspan fill="#C18B22" fontSize="58" fontStyle="italic" dx="-2">u</tspan><tspan dx="-2">m</tspan></text>
    </svg>
  );
}
