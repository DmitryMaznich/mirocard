import { mironiumLogoSvg } from "@/shared/brand/mironiumLogo.js";

const SVG = mironiumLogoSvg();

// The brand logo, inline (not <img>) so the wordmark picks up the app's DM Serif Display.
export default function MironiumLogo({ className = "" }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: SVG }} />;
}
