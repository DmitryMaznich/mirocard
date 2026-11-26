import { useEffect, useState } from 'react';
import { drawingLabelAttributes } from './labels.js';

export default function DrawingCover({ card, loadTopicFileUrl, topicId }) {
  const [url, setUrl] = useState(card.coverUrl);
  useEffect(() => {
    let active = true, ownedUrl;
    if (!card.coverUrl && loadTopicFileUrl) Promise.resolve(loadTopicFileUrl(topicId, card.image)).then(value => {
      if (value?.startsWith('blob:')) ownedUrl = value;
      if (active) setUrl(value);
      else if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    }).catch(() => {});
    return () => { active = false; if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [card.coverUrl, card.image, loadTopicFileUrl, topicId]);
  return url ? <img src={url} alt="" /> : <svg viewBox={card.lesson.viewBox} aria-hidden="true"><g fill="none" stroke="#26352d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    {card.lesson.steps.flatMap((step, i) => step.kind === 'stroke' ? step.paths.map((item, n) => <path key={`${i}-${n}`} d={typeof item === 'string' ? item : item.d} fill={item.fill ?? 'none'} />) : [])}
  </g>{card.lesson.labels?.map(label => <text key={label.id} {...drawingLabelAttributes(label)}>{label.text}</text>)}</svg>;
}
