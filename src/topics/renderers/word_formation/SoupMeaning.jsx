import { useTopicFile } from "@/shared/hooks/useTopicFile";

// These are schematic dishes, not photographs claiming a particular recipe.
function Dish({ kind }) {
  return <svg className="wf-meaning__dish" viewBox="0 0 180 140" aria-hidden="true">
    <ellipse cx="90" cy="95" rx="76" ry="32" fill="#fff" stroke="#b4c2c0" strokeWidth="4" />
    <ellipse cx="90" cy="95" rx="60" ry="21" fill="#eef3f2" />
    {kind === "cutlet" || kind === "cutlets"
      ? <>{[...(kind === "cutlets" ? [58, 115] : [90])].map(x => <g key={x}>
        <ellipse cx={x} cy="81" rx="29" ry="19" fill="#c99554" stroke="#986934" strokeWidth="3" />
        <path d={`M${x - 13} 78l9 3m2-9l11 3m-7 10l9 2`} stroke="#eed5ae" strokeWidth="3" />
      </g>)}</>
      : <><path d="M35 67 Q90 115 145 67 L131 104 Q90 131 49 104Z" fill="#e2ebe8" stroke="#8ca39c" strokeWidth="3" />
        <ellipse cx="90" cy="67" rx="55" ry="19" fill="#f2d595" stroke="#8ca39c" strokeWidth="3" />
        <path d="M65 64l12 5m20-8l10 6m-17 7l9 3" stroke="#b88844" strokeWidth="5" strokeLinecap="round" />
      </>}
  </svg>;
}

export default function SoupMeaning({ card, item, topicId }) {
  const ingredientUrl = useTopicFile(topicId, card.ingredientImage);
  const dishUrl = useTopicFile(topicId, !item || item.dishKind === "soup" ? card.image : null);
  const ingredient = card.noun ?? card.nounPhrase?.replace(/^суп из /i, "");
  const dish = item?.noun ?? "суп";
  return <div className="wf-meaning" aria-label={`${ingredient}. Готовим из этого продукта: ${dish}`}>
    <figure className="wf-meaning__figure">
      {ingredientUrl && <img src={ingredientUrl} alt="" draggable={false} />}
      <figcaption>{ingredient}</figcaption>
    </figure>
    <div className="wf-meaning__link"><span>готовим</span><span aria-hidden="true">→</span></div>
    <figure className="wf-meaning__figure">
      {dishUrl ? <img src={dishUrl} alt="" draggable={false} /> : <Dish kind={item?.dishKind} />}
      <figcaption>{dish}</figcaption>
    </figure>
  </div>;
}
