import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { getInitials, getTopicTitle } from "@/shared/utils/format";
import { getBuiltinTopicAsset } from "@/topics/builtinAssets";

export default function TopicCover({ topicId, avatarPath, title, size = "medium" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!topicId || !avatarPath) return;
    let objectUrl = null;
    getDb()
      .then((db) => topics.getFile(db, topicId, avatarPath))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        } else {
          setSrc(getBuiltinTopicAsset(topicId, avatarPath));
        }
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [topicId, avatarPath]);

  const cls = `topic-cover topic-cover--${size}`;

  if (!src) {
    return (
      <div className={`${cls} topic-cover--placeholder`}>
        {getInitials(getTopicTitle(title))}
      </div>
    );
  }

  return <img className={cls} src={src} alt={getTopicTitle(title)} />;
}
