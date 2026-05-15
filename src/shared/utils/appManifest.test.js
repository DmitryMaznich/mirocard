import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app manifest", () => {
  it("does not globally force portrait orientation", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));

    expect(manifest.orientation).toBe("any");
  });
});
