import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
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

    // Individualised topics can point directly at a photo stored in the
    // account photo store.  These are already safe browser URLs (or a local
    // data URL before their first sync) rather than files inside a deck ZIP.
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
