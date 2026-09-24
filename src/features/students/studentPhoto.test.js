import { describe, it, expect } from "vitest";
import { squareCropGeometry, STUDENT_PHOTO_MAX_SIDE } from "./studentPhoto";

describe("student/close-adult photo crop", () => {
  it("keeps up to 1440 px -- the server's long-side limit -- for tablet quality", () => {
    expect(STUDENT_PHOTO_MAX_SIDE).toBe(1440);
    expect(squareCropGeometry(4032, 3024)).toEqual({ sx: 504, sy: 0, side: 3024, size: 1440 });
  });
  it("never upscales a small photo", () => {
    expect(squareCropGeometry(800, 600).size).toBe(600);
  });
});
