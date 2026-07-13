import { api } from "@/core/api";

const MAX_DIMENSION = 640;
const WEBP_QUALITY = 0.72;

async function optimizePhotoToWebp(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Не удалось обработать фото");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  try {
    return await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
  } catch {
    return await canvas.convertToBlob({ type: "image/jpeg", quality: WEBP_QUALITY });
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Compresses a photo to WebP client-side, uploads it, and returns the short /api/photos/<hash> URL to persist on the step. */
export async function uploadInstructionPhoto(file) {
  const optimized = await optimizePhotoToWebp(file);
  const dataUrl = await blobToDataUrl(optimized);
  const { url } = await api.post("/photos", { dataUrl });
  return url;
}
