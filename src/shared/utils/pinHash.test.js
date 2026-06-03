import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "./pinHash";

describe("hashPin", () => {
  it("returns 64-char hex string", async () => {
    const hash = await hashPin("1234");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("same pin → same hash", async () => {
    expect(await hashPin("5678")).toBe(await hashPin("5678"));
  });

  it("different pins → different hashes", async () => {
    expect(await hashPin("1234")).not.toBe(await hashPin("1235"));
  });
});

describe("verifyPin", () => {
  it("returns true for correct pin", async () => {
    const hash = await hashPin("9999");
    expect(await verifyPin("9999", hash)).toBe(true);
  });

  it("returns false for wrong pin", async () => {
    const hash = await hashPin("9999");
    expect(await verifyPin("0000", hash)).toBe(false);
  });
});
