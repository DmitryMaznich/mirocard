import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

export function StoryFrame({ topicId, frame }) {
  const url = useTopicFile(topicId, frame.file);
  const crop = frame.crop;
  const placement = crop ? {
    width: `${100 / crop.width}%`, height: `${100 / crop.height}%`,
    left: `${-100 * crop.left / crop.width}%`, top: `${-100 * crop.top / crop.height}%`,
  } : undefined;
  return <figure className="story-frame">
    <div className="story-frame__image">{url && <img style={placement} src={url} alt={frame.alt ?? ""} draggable={false} />}</div>
  </figure>;
}

export function StoryPictures({ topicId, text }) {
  const frames = text.images?.length ? text.images : [{ file: text.image }];
  return (
    <div className={`story-frames${frames.length > 1 ? " story-frames--pair" : ""}`}>
      {frames.map((frame) => <StoryFrame key={frame.file} topicId={topicId} frame={frame} />)}
    </div>
  );
}

export function StoryPictureSupport({ topicId, text, onReveal }) {
  const [visible, setVisible] = useState(false);
  function toggle() {
    if (!visible) onReveal();
    setVisible(!visible);
  }
  return (
    <div className="story-picture-support">
      <button type="button" className="story-picture-support__toggle" aria-expanded={visible} onClick={toggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="9" r="1.5" fill="currentColor" /><path d="m4 17 5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {visible ? "Скрыть картинки" : "Показать картинки"}
      </button>
      {visible && <StoryPictures topicId={topicId} text={text} />}
    </div>
  );
}
