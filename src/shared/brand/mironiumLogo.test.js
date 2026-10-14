import { describe, it, expect } from "vitest";
import { mironiumLogoSvg } from "./mironiumLogo.js";

describe("mironiumLogoSvg", () => {
  it("draws the mark and the wordmark with the gold italic «u», in the app's DM Serif Display", () => {
    const svg = mironiumLogoSvg({ className: "x" });
    expect(svg).toContain('class="x"');
    expect(svg).toContain("DM Serif Display");
    expect(svg).toContain('fill="#C18B22" font-size="58" font-style="italic"');
    expect(svg).toContain('fill="#1C3634"');
  });

  it("lets the print footer keep a fonts-free Georgia stack", () => {
    const svg = mironiumLogoSvg({ font: "Georgia, serif" });
    expect(svg).not.toContain("DM Serif Display");
    expect(svg).toContain('font-family="Georgia, serif"');
  });
});
