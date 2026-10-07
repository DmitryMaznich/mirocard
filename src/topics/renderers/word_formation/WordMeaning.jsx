import { useTopicFile } from "@/shared/hooks/useTopicFile";
import SoupMeaning from "./SoupMeaning";

// The source and the result have the same roles in introduction and choice.
// Weather and seasons retain their explicit textual context instead of implying
// that a pictured object is made from rain or from a season.
export default function WordMeaning({ card, topicId }) {
  const source = useTopicFile(topicId, card.ingredientImage ?? card.image);
  const result = useTopicFile(topicId, card.image);
  if (card.category === "soup") return <SoupMeaning card={card} topicId={topicId} />;
  const paired = ["juice", "jam", "kasha", "materials"].includes(card.category);
  if (!paired) return source ? <img className="wf-pair__visual-img wf-pair__visual-img--solo" src={source} alt="" draggable={false} /> : null;
  const noun = card.nounPhrase?.split(/\s+/)[0];
  const action = card.category === "materials" ? "делаем" : "готовим";
  return <div className="wf-meaning" aria-label={`${card.noun}. ${action}: ${noun}`}>
    <figure className="wf-meaning__figure">
      {source && <img src={source} alt="" draggable={false} />}
      <figcaption>{card.noun}</figcaption>
    </figure>
    <div className="wf-meaning__link"><span>{action}</span><span aria-hidden="true">→</span></div>
    <figure className="wf-meaning__figure">
      {result && <img src={result} alt="" draggable={false} />}
      <figcaption>{noun}</figcaption>
    </figure>
  </div>;
}
