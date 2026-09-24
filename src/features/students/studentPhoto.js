// Student and close-adult photos: square centre crop, up to 1440 px -- the
// same long side the server keeps (PHOTO_MAX_LONG_SIDE). The server then
// re-encodes to a bounded WebP <= 650 KiB (backend/lib/photo-normalizer.mjs).
// Smaller client pre-crops (200/400/1024 px) looked soft on a tablet and
// can't be recovered server-side. Never upscales a smaller photo.
export const STUDENT_PHOTO_MAX_SIDE = 1440;
export const STUDENT_PHOTO_JPEG_QUALITY = 0.9;

/** Square crop geometry for an image of width x height. */
export function squareCropGeometry(width, height, maxSide = STUDENT_PHOTO_MAX_SIDE) {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side, size: Math.min(side, maxSide) };
}

export function resizeStudentPhotoToDataUrl(file, maxSide = STUDENT_PHOTO_MAX_SIDE) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { sx, sy, side, size } = squareCropGeometry(img.width, img.height, maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", STUDENT_PHOTO_JPEG_QUALITY));
    };
    img.src = url;
  });
}
