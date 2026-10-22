import { useTopicFile } from "@/shared/hooks/useTopicFile";

// Word cards arrive with their picture already inlined (imageUrl, set on
// install); the distractors live on the mode, so theirs is read from the topic files.
export default function CardImage({ topicId, card }) {
  const fileUrl = useTopicFile(topicId, card?.imageUrl ? null : card?.image);
  const src = card?.imageUrl ?? fileUrl;
  if (!src) return <span className="bw-img bw-img--loading" />;
  return <img className="bw-img" src={src} alt="" draggable={false} />;
}
