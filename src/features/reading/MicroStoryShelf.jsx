import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { getTopicTitle } from "@/shared/utils/format";
import "./MicroStoryShelf.css";

/*
 * «Короткие рассказы» setup: the micro-stories as a shelf of covers, grouped
 * by the collection's three levels, with a filter by recurring hero
 * (mockup docs/mockups/reading-micro-2026-11-04/reading-micro-v01.html, A).
 * The stored value keeps the old contract of the story picker: [] means all.
 */

const HERO_COLORS = { "Вова": "#3b6fd8", "Петя": "#2f9a55", "Аня": "#e0882b", "Оля": "#e0645a" };
const LEVELS = [
  { level: 1, title: "Шаг за шагом", note: "одно действие за другим" },
  { level: 2, title: "Что-то случилось", note: "проблема и как её решили" },
  { level: 3, title: "Вдвоём", note: "двое героев, просьба, разговор" },
];

function plural(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return forms[mod100 >= 11 && mod100 <= 14 ? 2 : mod10 === 1 ? 0 : mod10 >= 2 && mod10 <= 4 ? 1 : 2];
}

function Cover({ topicId, story, checked, dimmed, onToggle }) {
  const frame = story.images?.[0] ?? (story.image ? { file: story.image } : null);
  const url = useTopicFile(topicId, frame?.file);
  const crop = frame?.crop;
  const placement = crop ? {
    width: `${100 / crop.width}%`, height: `${100 / crop.height}%`,
    left: `${-100 * crop.left / crop.width}%`, top: `${-100 * crop.top / crop.height}%`,
  } : undefined;
  const title = getTopicTitle(story.title);
  return <label className={`mss-cover${checked ? " is-checked" : ""}${dimmed ? " is-dimmed" : ""}`}>
    <input type="checkbox" checked={checked} onChange={onToggle} aria-label={title} />
    <span className="mss-cover__img">
      {url && <img src={url} style={placement} alt="" draggable={false} />}
      {story.character && <span className="mss-avatar" style={{ background: HERO_COLORS[story.character] ?? "#4a9b8f" }} aria-hidden="true">{story.character[0]}</span>}
      {checked && <span className="mss-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
    </span>
    <span className="mss-cover__title">{title}</span>
  </label>;
}

export default function MicroStoryShelf({ topicId, stories, options, value, onChange }) {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const ordered = options.map((id) => byId.get(id)).filter(Boolean);
  const selected = Array.isArray(value) ? value.filter((id) => options.includes(id)) : [];
  const allSelected = selected.length === 0;
  const heroes = [...new Set(ordered.map((story) => story.character).filter(Boolean))];
  const idsOf = (filter) => ordered.filter(filter).map((story) => story.id);
  const sameSet = (ids) => !allSelected && ids.length === selected.length && ids.every((id) => selected.includes(id));

  function choose(ids) {
    onChange(ids.length === 0 || ids.length === options.length ? [] : ids);
  }
  function toggle(id) {
    if (allSelected) { onChange([id]); return; }
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    choose(options.filter((option) => next.includes(option)));
  }

  const count = allSelected ? options.length : selected.length;
  const levels = LEVELS.map((level) => ({ ...level, stories: ordered.filter((story) => (story.microLevel ?? 1) === level.level) }))
    .filter((level) => level.stories.length);

  return <div className="param-row param-row--block mss">
    <div className="mss-head">
      <span className="param-label">Рассказы</span>
      <span className="mss-summary" aria-live="polite">{allSelected ? `Все ${options.length} рассказов` : `Выбрано: ${count} ${plural(count, ["рассказ", "рассказа", "рассказов"])}`}</span>
    </div>
    <div className="mss-heroes" role="group" aria-label="Герои">
      <button type="button" className={`mss-hero${allSelected ? " is-on" : ""}`} onClick={() => onChange([])}>Все</button>
      {heroes.map((hero) => {
        const ids = idsOf((story) => story.character === hero);
        return <button type="button" key={hero} className={`mss-hero${sameSet(ids) ? " is-on" : ""}`} onClick={() => choose(ids)}>
          <span className="mss-avatar mss-avatar--chip" style={{ background: HERO_COLORS[hero] ?? "#4a9b8f" }} aria-hidden="true">{hero[0]}</span>{hero}
        </button>;
      })}
    </div>
    {levels.map((level) => {
      const ids = level.stories.map((story) => story.id);
      return <section className="mss-level" key={level.level} aria-label={`Уровень ${level.level}: ${level.title}`}>
        <button type="button" className={`mss-level__head${sameSet(ids) ? " is-on" : ""}`} onClick={() => choose(ids)}>
          <span className="mss-level__n">{level.level}</span><b>{level.title}</b><span>{level.note}</span>
        </button>
        <div className="mss-covers">
          {level.stories.map((story) => <Cover key={story.id} topicId={topicId} story={story}
            checked={!allSelected && selected.includes(story.id)} dimmed={!allSelected && !selected.includes(story.id)}
            onToggle={() => toggle(story.id)} />)}
        </div>
      </section>;
    })}
  </div>;
}
