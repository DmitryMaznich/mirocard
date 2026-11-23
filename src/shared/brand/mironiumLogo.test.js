import { describe, it, expect } from "vitest";
import { mironiumLogoSvg, LOGO_GOLD, LOGO_INK } from "./mironiumLogo.js";

describe("mironiumLogoSvg", () => {
  it("draws the mark, the word and the gold «u» as outlines — no font needed", () => {
    const svg = mironiumLogoSvg({ className: "x" });
    expect(svg).toContain('class="x"');
    expect(svg).toContain(`fill="${LOGO_INK}"`);
    expect(svg).toContain(`fill="${LOGO_GOLD}"`);
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("font-family");
    expect((svg.match(/<path /g) || []).length).toBe(3);
  });

  it("can be recoloured for a dark background", () => {
    const svg = mironiumLogoSvg({ ink: "#FFFFFF", gold: "#F2C45A" });
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('fill="#F2C45A"');
  });
});
