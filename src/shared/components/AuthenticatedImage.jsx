import { useEffect, useState } from "react";
import { getApiToken } from "@/core/api";

// GET /api/photos/:hash now requires an authenticated request (closing what
// used to be fully anonymous access to uploaded child/close-adult photos --
// see backend/server.mjs's handleGetPhoto). A plain <img src="..."> can
// never attach a custom Authorization header, so anything that used to
// render a stored photo URL directly needs to go through this instead: it
// fetches the bytes with the auth header and hands <img> a local blob: URL.
// Any src that isn't a /photos/ URL (a data: URL from a fresh unsaved
// upload, a bundled asset path) is passed through unchanged -- this is a
// drop-in replacement for <img>, not a photos-only component.
export default function AuthenticatedImage({ src, alt = "", ...rest }) {
  const isPhotoUrl = Boolean(src) && src.includes("/photos/");
  const [blobSrc, setBlobSrc] = useState(null);

  useEffect(() => {
    if (!isPhotoUrl) return undefined;

    let cancelled = false;
    let objectUrl = null;
    const token = getApiToken();

    fetch(src, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setBlobSrc(null); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, isPhotoUrl]);

  const resolvedSrc = isPhotoUrl ? blobSrc : (src ?? null);
  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} {...rest} />;
}
