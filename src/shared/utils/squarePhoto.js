// Turns a picked image file into a centre-cropped square JPEG data URL.
//
// Two failure modes this exists to close (both used to leave the upload
// button stuck on "Готовим фото…" forever, because the old helpers never
// listened for the image's error event):
//   1. A file the browser can't decode at all -- rejected with a message the
//      screen can show instead of hanging.
//   2. HEIC/HEIF from an iPhone opened in a browser without a native HEIC
//      decoder (Chrome/Firefox on Android, Windows, Mac). Safari decodes HEIC
//      itself, so the ~3 MB libheif converter is only fetched on this path.

const DECODE_TIMEOUT_MS = 30_000;

// ISO-BMFF brands used by HEIC/HEIF stills (bytes 8..12 after "ftyp").
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

export class PhotoPrepareError extends Error {}

// Listing .heic makes desktop file dialogs show iPhone photos synced to a
// PC/Mac. Not on iOS: with a plain image/* input iOS itself hands over a
// JPEG, while naming HEIC there can get the original HEIC file instead.
const IS_IOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);
export const PHOTO_ACCEPT = IS_IOS ? "image/*" : "image/*,.heic,.heif";

async function looksLikeHeif(file) {
  if (/^image\/hei[cf](-sequence)?$/i.test(file.type ?? "")) return true;
  if (/\.hei[cf]$/i.test(file.name ?? "")) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const text = String.fromCharCode(...head);
    return text.slice(4, 8) === "ftyp" && HEIF_BRANDS.has(text.slice(8, 12));
  } catch {
    return false;
  }
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    const timer = setTimeout(() => finish(new Error("timeout")), DECODE_TIMEOUT_MS);
    function finish(error) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(image);
    }
    image.onload = () => finish(null);
    image.onerror = () => finish(new Error("decode"));
    image.src = url;
  });
}

// A classic <script>, not import(): the app is built as a single inlined
// index.html, which would pull a dynamic import's 3 MB into every page load.
// scripts/sync-capture-tool.mjs copies the file into public/vendor/.
let heicToLoading = null;
function loadHeicTo() {
  if (window.HeicTo) return Promise.resolve(window.HeicTo);
  heicToLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${import.meta.env.BASE_URL}vendor/heic-to.js`;
    script.async = true;
    script.onload = () => (window.HeicTo ? resolve(window.HeicTo) : reject(new Error("HeicTo missing")));
    script.onerror = () => {
      heicToLoading = null; // let a later attempt retry, e.g. after going back online
      script.remove();
      reject(new Error("heic-to failed to load"));
    };
    document.head.appendChild(script);
  });
  return heicToLoading;
}

async function convertHeifToJpeg(file) {
  const heicTo = await loadHeicTo();
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
}

async function decode(file) {
  try {
    return await loadImage(file);
  } catch {
    if (!(await looksLikeHeif(file))) {
      throw new PhotoPrepareError("Не получилось открыть это фото. Попробуйте другое — в формате JPG или PNG.");
    }
  }
  try {
    return await loadImage(await convertHeifToJpeg(file));
  } catch {
    throw new PhotoPrepareError("Не получилось открыть фото HEIC. Попробуйте ещё раз или выберите фото в формате JPG.");
  }
}

export async function squarePhotoDataUrl(file, { maxSize, quality }) {
  const image = await decode(file);
  const side = Math.min(image.width, image.height);
  if (!side) throw new PhotoPrepareError("Фото пустое или повреждено. Выберите другое.");
  const target = Math.min(side, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  canvas.getContext("2d").drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    target,
    target,
  );
  return canvas.toDataURL("image/jpeg", quality);
}
