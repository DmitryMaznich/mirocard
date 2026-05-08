import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { getBuiltinTopicAsset } from "@/topics/builtinAssets";

export default function ModeIcon({ topicId, iconPath, size = "medium" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!topicId || !iconPath) return;
    let objectUrl = null;
    getDb()
      .then((db) => topics.getFile(db, topicId, iconPath))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        } else {
          setSrc(getBuiltinTopicAsset(topicId, iconPath));
        }
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [topicId, iconPath]);

  if (!src) return null;

  return (
    <img
      className={`mode-icon mode-icon--${size}`}
      src={src}
      alt=""
      aria-hidden="true"
    />
  );
}
