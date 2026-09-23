// Server-side normalization for every user photo (student, close adults,
// "Мои люди", instruction steps, and legacy data: URLs migrated at startup).
//
// Never trusts the client's MIME type or file extension: the bytes are
// decoded by libvips, and only a real JPEG/PNG/WebP image is accepted. The
// result is always a metadata-stripped WebP (EXIF orientation applied, GPS
// and other EXIF dropped), no larger than PHOTO_LIMITS.maxLongSide on its
// long side and no heavier than PHOTO_LIMITS.maxOutputBytes -- so what lands
// in SQLite is always bounded, whatever the client sent.

import { createHash } from "node:crypto";
import sharp from "sharp";
import { PHOTO_LIMITS } from "./config.mjs";

// One process serves every request: keep libvips from holding decoded
// images in its operation cache between uploads.
sharp.cache(false);

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class PhotoRejectedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PhotoRejectedError";
    this.code = code;
  }
}

// User-facing texts (Russian UI). `code` is stable for clients/tests.
const MESSAGES = {
  malformed: "Не удалось прочитать фото. Попробуйте выбрать его ещё раз.",
  too_large_input: (limitMb) => `Фото слишком большое (больше ${limitMb} МБ). Выберите другое фото или сделайте снимок заново.`,
  not_image: "Этот файл не похож на фото. Выберите фото в формате JPEG, PNG или WebP.",
  heic_unsupported: "Фото в формате HEIC пока не поддерживается. На iPhone: Настройки → Камера → Форматы → «Наиболее совместимые», или выберите фото через галерею — она обычно отдаёт JPEG.",
  unsupported_format: "Этот формат фото не поддерживается. Выберите фото в формате JPEG, PNG или WebP.",
  too_many_pixels: "Разрешение фото слишком большое. Выберите фото поменьше (до 16 мегапикселей).",
  too_large_output: "Не получилось уменьшить это фото до допустимого размера. Попробуйте другое фото.",
};

function limitMb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

// Accepts `data:<anything>;base64,<payload>` only. The declared MIME type is
// ignored -- the decoder decides what the bytes are.
export function decodeDataUrl(dataUrl, { maxInputBytes = PHOTO_LIMITS.maxInputBytes } = {}) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new PhotoRejectedError("malformed", MESSAGES.malformed);
  }
  const comma = dataUrl.indexOf(",");
  const header = comma === -1 ? "" : dataUrl.slice(5, comma);
  if (comma === -1 || !/;base64$/i.test(header)) {
    throw new PhotoRejectedError("malformed", MESSAGES.malformed);
  }
  const payload = dataUrl.slice(comma + 1).replace(/\s+/g, "");
  // Cheap pre-check before allocating: base64 inflates by 4/3.
  if (payload.length > Math.ceil(maxInputBytes * 4 / 3) + 4) {
    throw new PhotoRejectedError("too_large_input", MESSAGES.too_large_input(limitMb(maxInputBytes)));
  }
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload) || payload.length % 4 === 1) {
    throw new PhotoRejectedError("malformed", MESSAGES.malformed);
  }
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length === 0) throw new PhotoRejectedError("malformed", MESSAGES.malformed);
  if (buffer.length > maxInputBytes) {
    throw new PhotoRejectedError("too_large_input", MESSAGES.too_large_input(limitMb(maxInputBytes)));
  }
  return buffer;
}

// ISO-BMFF "ftyp" brands used by HEIC/HEIF stills. Detected up front so the
// user gets a specific, actionable message instead of a generic decode error.
function isHeic(buffer) {
  if (buffer.length < 12 || buffer.toString("latin1", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("latin1", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
}

async function encode(buffer, longSide, quality, maxInputPixels) {
  return sharp(buffer, { limitInputPixels: maxInputPixels, failOn: "error" })
    .rotate() // apply EXIF orientation, then EXIF is dropped (no withMetadata)
    .resize({ width: longSide, height: longSide, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });
}

export function photoHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 32);
}

/**
 * Decodes, validates and re-encodes an image buffer to a bounded WebP.
 * Tries quality first (at maxLongSide), then smaller long sides down to
 * minLongSide at minQuality. Returns the first result within the target
 * size, else the smallest one within the hard maximum, else rejects.
 */
export async function normalizePhotoBuffer(input, limits = PHOTO_LIMITS) {
  const {
    maxInputBytes, maxInputPixels, maxLongSide, minLongSide,
    startQuality, minQuality, targetOutputBytes, maxOutputBytes,
  } = { ...PHOTO_LIMITS, ...limits };

  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new PhotoRejectedError("malformed", MESSAGES.malformed);
  }
  if (input.length > maxInputBytes) {
    throw new PhotoRejectedError("too_large_input", MESSAGES.too_large_input(limitMb(maxInputBytes)));
  }
  if (isHeic(input)) throw new PhotoRejectedError("heic_unsupported", MESSAGES.heic_unsupported);

  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: maxInputPixels, failOn: "error" }).metadata();
  } catch (err) {
    if (/pixel limit/i.test(String(err?.message))) {
      throw new PhotoRejectedError("too_many_pixels", MESSAGES.too_many_pixels);
    }
    throw new PhotoRejectedError("not_image", MESSAGES.not_image);
  }
  if (meta.format === "heif") throw new PhotoRejectedError("heic_unsupported", MESSAGES.heic_unsupported);
  if (!ACCEPTED_FORMATS.has(meta.format)) {
    throw new PhotoRejectedError("unsupported_format", MESSAGES.unsupported_format);
  }
  if (!meta.width || !meta.height) throw new PhotoRejectedError("not_image", MESSAGES.not_image);
  if (meta.width * meta.height > maxInputPixels) {
    throw new PhotoRejectedError("too_many_pixels", MESSAGES.too_many_pixels);
  }

  const attempts = [];
  for (let q = startQuality; q >= minQuality; q -= 8) attempts.push([maxLongSide, q]);
  if (attempts.at(-1)?.[1] !== minQuality) attempts.push([maxLongSide, minQuality]);
  for (let side = maxLongSide - 128; side > minLongSide; side -= 128) attempts.push([side, minQuality]);
  if (minLongSide < maxLongSide) attempts.push([minLongSide, minQuality]);

  let best = null;
  for (const [longSide, quality] of attempts) {
    let out;
    try {
      out = await encode(input, longSide, quality, maxInputPixels);
    } catch {
      // Header decoded but pixel data is corrupt/truncated.
      throw new PhotoRejectedError("not_image", MESSAGES.not_image);
    }
    if (!best || out.data.length < best.data.length) best = out;
    if (out.data.length <= targetOutputBytes) { best = out; break; }
  }
  if (best.data.length > maxOutputBytes) {
    throw new PhotoRejectedError("too_large_output", MESSAGES.too_large_output);
  }
  return {
    buffer: best.data,
    contentType: "image/webp",
    width: best.info.width,
    height: best.info.height,
    bytes: best.data.length,
    hash: photoHash(best.data),
  };
}

export async function normalizePhotoDataUrl(dataUrl, limits = PHOTO_LIMITS) {
  const buffer = decodeDataUrl(dataUrl, { maxInputBytes: limits.maxInputBytes ?? PHOTO_LIMITS.maxInputBytes });
  return normalizePhotoBuffer(buffer, limits);
}
