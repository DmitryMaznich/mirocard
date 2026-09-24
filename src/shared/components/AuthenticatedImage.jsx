import { useProtectedPhotoSrc } from "@/shared/utils/protectedPhoto";

// Drop-in replacement for <img> for anything that may be a user photo.
// GET /api/photos/:hash requires the owner's Authorization header, which a
// plain <img src> can't send; this resolves it to a blob: URL through the
// shared loader (shared/utils/protectedPhoto.js). Any other src (a data:
// URL from a fresh unsaved upload, a bundled asset) passes through as-is.
export default function AuthenticatedImage({ src, alt = "", ...rest }) {
  const resolvedSrc = useProtectedPhotoSrc(src);
  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} {...rest} />;
}
