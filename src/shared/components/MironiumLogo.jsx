import { mironiumLogoSvg } from "@/shared/brand/mironiumLogo.js";

const SVG = mironiumLogoSvg();

// The brand logo, inline (not <img>): outlines from mironiumLogo.js, no font to wait for.
export default function MironiumLogo({ className = "" }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: SVG }} />;
}
