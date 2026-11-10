import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { getInitials, getTopicTitle } from "@/shared/utils/format";
import { getBuiltinTopicAsset } from "@/topics/builtinAssets";
import { CATALOG_COVER_PATH, catalogCoverUrl } from "@/features/topics/catalogCovers";

export default function TopicCover({ topicId, avatarPath, title, size = "medium" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!topicId || !avatarPath) return;
    if (avatarPath === CATALOG_COVER_PATH) return undefined;
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
  // A catalog cover is bundled; no IndexedDB lookup (topic UI preview only).
  const shown = avatarPath === CATALOG_COVER_PATH ? catalogCoverUrl(topicId) : src;

  if (!shown) {
    return (
      <div className={`${cls} topic-cover--placeholder`}>
        {getInitials(getTopicTitle(title))}
      </div>
    );
  }

  return <img className={cls} src={shown} alt={getTopicTitle(title)} />;
}
