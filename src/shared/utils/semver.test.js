import { describe, it, expect } from "vitest";
import { semver } from "./semver";

describe("semver.lt", () => {
  it("returns true when a < b", () => {
    expect(semver.lt("1.0.0", "2.0.0")).toBe(true);
    expect(semver.lt("2.0.9", "2.1.0")).toBe(true);
    expect(semver.lt("2.1.0", "2.1.1")).toBe(true);
  });
  it("returns false when a === b", () => {
    expect(semver.lt("1.2.3", "1.2.3")).toBe(false);
  });
  it("returns false when a > b", () => {
    expect(semver.lt("2.0.0", "1.9.9")).toBe(false);
  });
});

describe("semver.gte", () => {
  it("returns true when a > b", () => {
    expect(semver.gte("2.0.0", "1.0.0")).toBe(true);
  });
  it("returns true when a === b", () => {
    expect(semver.gte("1.2.3", "1.2.3")).toBe(true);
  });
  it("returns false when a < b", () => {
    expect(semver.gte("1.0.0", "2.0.0")).toBe(false);
  });
});

describe("semver.eq", () => {
  it("returns true for equal versions", () => {
    expect(semver.eq("1.0.0", "1.0.0")).toBe(true);
  });
  it("returns false for different versions", () => {
    expect(semver.eq("1.0.0", "1.0.1")).toBe(false);
  });
});
