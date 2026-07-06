import { useTopicFile } from "@/shared/hooks/useTopicFile";

export default function WordPicture({ topicId, path, emoji, size = 150 }) {
  const url = useTopicFile(topicId, path);
  return (
    <div className="pa-picture" style={{ width: size, height: size }}>
      {url
        ? <img className="pa-picture-img" src={url} alt="" draggable={false} />
        : <span className="pa-picture-emoji" style={{ fontSize: size * 0.55 }}>{emoji}</span>}
    </div>
  );
}
