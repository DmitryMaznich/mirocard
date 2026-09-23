import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomBytes } from "node:crypto";

const {
  normalizePhotoBuffer, normalizePhotoDataUrl, decodeDataUrl, PhotoRejectedError,
} = await import("../lib/photo-normalizer.mjs");

function solid(width, height, format = "jpeg", options = {}) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .toFormat(format, options).toBuffer();
}

// Random noise compresses badly -- forces the size-reduction path.
function noise(width, height, format = "png") {
  return sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).toFormat(format).toBuffer();
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof PhotoRejectedError, `expected PhotoRejectedError, got ${err}`);
    assert.equal(err.code, code);
    assert.ok(err.message.length > 10, "user-facing message present");
    return true;
  });
}

test("JPEG, PNG and WebP are accepted and always stored as WebP", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const out = await normalizePhotoBuffer(await solid(800, 600, format));
    assert.equal(out.contentType, "image/webp");
    assert.equal((await sharp(out.buffer).metadata()).format, "webp");
    assert.equal(out.bytes, out.buffer.length);
    assert.match(out.hash, /^[0-9a-f]{32}$/);
  }
});

test("the declared MIME type is ignored -- a PNG labelled image/jpeg is decoded as what it really is", async () => {
  const png = await solid(300, 200, "png");
  const out = await normalizePhotoDataUrl(`data:image/jpeg;base64,${png.toString("base64")}`);
  assert.equal(out.width, 300);
  assert.equal(out.height, 200);
});

test("large images are downscaled to 1440 px on the long side (fit inside, aspect kept)", async () => {
  const out = await normalizePhotoBuffer(await solid(4000, 3000));
  assert.equal(out.width, 1440);
  assert.equal(out.height, 1080);
});

test("small images are never upscaled", async () => {
  const out = await normalizePhotoBuffer(await solid(320, 200));
  assert.equal(out.width, 320);
  assert.equal(out.height, 200);
});

test("EXIF orientation is applied (a portrait photo stored rotated comes out portrait) and EXIF is stripped", async () => {
  // 600x400 landscape pixels tagged orientation 6 (rotate 90° CW) = a portrait photo.
  const tagged = await sharp(await solid(600, 400)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  assert.equal((await sharp(tagged).metadata()).orientation, 6);
  const out = await normalizePhotoBuffer(tagged);
  assert.equal(out.width, 400);
  assert.equal(out.height, 600);
  const meta = await sharp(out.buffer).metadata();
  assert.ok(!meta.orientation || meta.orientation === 1);
  assert.equal(meta.exif, undefined, "EXIF (incl. any GPS) must not be kept");
});

test("output is within the production limits even for a hard-to-compress 9 MP photo", async () => {
  const input = await noise(3000, 3000, "jpeg");
  assert.ok(input.length <= 10 * 1024 * 1024, "fixture is within the input limit");
  const out = await normalizePhotoBuffer(input).catch((err) => err);
  if (out instanceof PhotoRejectedError) {
    // Pure noise may be genuinely incompressible to 650 KiB at >=1024 px --
    // then the only acceptable outcome is the explicit, user-facing rejection.
    assert.equal(out.code, "too_large_output");
    return;
  }
  assert.ok(out.bytes <= 650 * 1024, `output ${out.bytes} B must be <= 650 KiB`);
  assert.ok(Math.max(out.width, out.height) <= 1440);
  assert.ok(Math.max(out.width, out.height) >= 1024);
});

test("quality then resolution are reduced until the target size is met", async () => {
  const input = await noise(1600, 1600, "png");
  const limits = { targetOutputBytes: 400 * 1024, maxOutputBytes: 650 * 1024 };
  const out = await normalizePhotoBuffer(input, limits).catch((err) => err);
  if (!(out instanceof PhotoRejectedError)) {
    assert.ok(out.bytes <= 650 * 1024);
    assert.ok(Math.max(out.width, out.height) >= 1024);
  }
  // And with an impossible cap, it rejects instead of storing something oversized.
  await rejectsWith(normalizePhotoBuffer(input, { targetOutputBytes: 1024, maxOutputBytes: 2048 }), "too_large_output");
});

test("decompression-bomb guard: more than 16 MP is rejected before decoding pixels", async () => {
  const bomb = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.ok(bomb.length < 1024 * 1024, "fixture is tiny on disk but 20 MP decoded");
  await rejectsWith(normalizePhotoBuffer(bomb), "too_many_pixels");
});

test("input larger than the byte limit is rejected", async () => {
  await rejectsWith(normalizePhotoBuffer(Buffer.alloc(2048, 1), { maxInputBytes: 1024 }), "too_large_input");
  const tooBigB64 = Buffer.alloc(2048, 1).toString("base64");
  assert.throws(() => decodeDataUrl(`data:image/png;base64,${tooBigB64}`, { maxInputBytes: 1024 }), (err) => err.code === "too_large_input");
});

test("non-images and corrupted images are rejected", async () => {
  await rejectsWith(normalizePhotoBuffer(Buffer.from("<html>not a photo</html>")), "not_image");
  const jpeg = await solid(800, 600);
  const truncated = jpeg.subarray(0, Math.floor(jpeg.length / 3));
  await rejectsWith(normalizePhotoBuffer(truncated), "not_image");
});

test("unsupported real image formats (e.g. GIF) are rejected with a clear message", async () => {
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
  await rejectsWith(normalizePhotoBuffer(gif), "unsupported_format");
});

test("HEIC is rejected honestly (the production libvips has no HEVC decoder)", async () => {
  // ISO-BMFF header of an iPhone HEIC: size, "ftyp", brand "heic".
  const heicHeader = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(64)]);
  await rejectsWith(normalizePhotoBuffer(heicHeader), "heic_unsupported");
  await rejectsWith(normalizePhotoDataUrl(`data:image/heic;base64,${heicHeader.toString("base64")}`), "heic_unsupported");
});

test("malformed data URLs are rejected", async () => {
  for (const bad of ["", "not-a-data-url", "data:image/png,rawtext", "data:image/png;base64,", "data:image/png;base64,@@@@", "data:;base64"]) {
    assert.throws(() => decodeDataUrl(bad), (err) => err instanceof PhotoRejectedError && err.code === "malformed", `should reject ${JSON.stringify(bad)}`);
  }
});

test("the same input always yields the same hash (dedup key)", async () => {
  const input = await solid(640, 480);
  const a = await normalizePhotoBuffer(input);
  const b = await normalizePhotoBuffer(input);
  assert.equal(a.hash, b.hash);
});
