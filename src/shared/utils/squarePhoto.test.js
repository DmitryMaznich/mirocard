import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stands in for the converter loaded from public/vendor/heic-to.js.
const heic = { heicTo: vi.fn() };

import { PhotoPrepareError, squarePhotoDataUrl } from "./squarePhoto";

// jsdom can't decode images; a fake Image decides per blob whether it
// "loads" (as the given size) or fires onerror, like a browser would.
let decodable;
class FakeImage {
  set src(url) {
    const blob = urls.get(url);
    queueMicrotask(() => {
      const size = decodable.get(blob);
      if (size) { this.width = size[0]; this.height = size[1]; this.onload(); }
      else this.onerror();
    });
  }
}
const urls = new Map();

beforeEach(() => {
  decodable = new Map();
  heic.heicTo.mockReset();
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("HeicTo", heic.heicTo);
  URL.createObjectURL = vi.fn((blob) => { const url = `blob:${urls.size}`; urls.set(url, blob); return url; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,OUT");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const heifBytes = new Uint8Array([0, 0, 0, 24, ...[..."ftypheic"].map((c) => c.charCodeAt(0))]);

describe("squarePhotoDataUrl", () => {
  it("crops a decodable photo to a square no larger than maxSize", async () => {
    const file = new File(["jpg"], "a.jpg", { type: "image/jpeg" });
    decodable.set(file, [3000, 2000]);

    await expect(squarePhotoDataUrl(file, { maxSize: 1600, quality: 0.9 })).resolves.toBe("data:image/jpeg;base64,OUT");
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
    expect(heic.heicTo).not.toHaveBeenCalled();
  });

  it("rejects an undecodable non-HEIC file instead of hanging", async () => {
    const file = new File(["garbage"], "a.png", { type: "image/png" });

    await expect(squarePhotoDataUrl(file, { maxSize: 400, quality: 0.85 })).rejects.toBeInstanceOf(PhotoPrepareError);
    expect(heic.heicTo).not.toHaveBeenCalled();
  });

  it("converts HEIC through heic-to when the browser can't decode it, even with no type or extension", async () => {
    const file = new File([heifBytes], "IMG_0001", { type: "" });
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    heic.heicTo.mockResolvedValue(jpeg);
    decodable.set(jpeg, [1000, 1000]);

    await expect(squarePhotoDataUrl(file, { maxSize: 1600, quality: 0.9 })).resolves.toBe("data:image/jpeg;base64,OUT");
    expect(heic.heicTo).toHaveBeenCalledWith({ blob: file, type: "image/jpeg", quality: 0.92 });
  });

  it("reports a HEIC conversion failure as a readable error", async () => {
    const file = new File(["x"], "IMG_0001.HEIC", { type: "image/heic" });
    heic.heicTo.mockRejectedValue(new Error("libheif"));

    await expect(squarePhotoDataUrl(file, { maxSize: 1600, quality: 0.9 })).rejects.toThrow(/HEIC/);
  });
});
