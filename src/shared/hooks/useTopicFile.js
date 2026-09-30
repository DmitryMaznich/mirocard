import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { getApiToken } from "@/core/api";
import { RECIPES_TOPIC_ID, RECIPES_MEDIA_BASE_URL } from "@/topics/builtinRecipesTopic";

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

    let objectUrl = null;
    let cancelled = false;

    // Individualised topics ("Мои люди") point directly at the account photo
    // store.  GET /api/photos/:hash requires a Bearer token, which a plain
    // <img src> can never send -- rendering the URL directly 401s and the
    // photo silently vanishes as soon as a sync swaps the local data: URL for
    // the stored reference.  Fetch it with auth and hand back a blob: URL.
    if (filePath.startsWith("/api/photos/")) {
      const token = getApiToken();
      fetch(filePath, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setUrl(null);
      };
    }

    // Local data URLs (before their first sync), bundled assets and absolute
    // URLs are already safe browser URLs rather than files inside a deck ZIP.
    if (/^(?:data:|blob:|https?:\/\/|\/api\/)/.test(filePath)) {
      setUrl(filePath);
      return;
    }

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
