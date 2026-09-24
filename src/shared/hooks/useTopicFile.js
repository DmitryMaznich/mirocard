import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { RECIPES_TOPIC_ID, RECIPES_MEDIA_BASE_URL } from "@/topics/builtinRecipesTopic";
import { isProtectedPhotoUrl, loadProtectedPhoto } from "@/shared/utils/protectedPhoto";

export function useTopicFile(topicId, filePath) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!topicId || !filePath) {
      setUrl(null);
      return;
    }

    if (topicId === RECIPES_TOPIC_ID) {
      setUrl(`${RECIPES_MEDIA_BASE_URL}${filePath}`);
      return;
    }

    // Individualised topics can point directly at a photo stored in the
    // account photo store.  These are already safe browser URLs (or a local
    // data URL before their first sync) rather than files inside a deck ZIP.
    // Owner-only user photos need the Authorization header (see
    // shared/utils/protectedPhoto.js) -- e.g. "Мои люди" task images.
    if (isProtectedPhotoUrl(filePath)) {
      let cancelled = false;
      setUrl(null);
      loadProtectedPhoto(filePath)
        .then((resolved) => { if (!cancelled) setUrl(resolved); })
        .catch(() => { if (!cancelled) setUrl(null); });
      return () => { cancelled = true; };
    }
    if (/^(?:data:|blob:|https?:\/\/|\/api\/)/.test(filePath)) {
      setUrl(filePath);
      return;
    }

    let objectUrl = null;
    getDb()
      .then((db) => topics.getFile(db, topicId, filePath))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [topicId, filePath]);

  return url;
}
