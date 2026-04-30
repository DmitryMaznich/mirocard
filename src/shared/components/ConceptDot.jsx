const LEVEL_COLORS = ["#bdbdbd", "#ef5350", "#ffa726", "#66bb6a"];
const LEVEL_TITLES = ["Не видели", "Знакомимся", "Узнаёт", "Усвоено"];

export default function ConceptDot({ level = 0, size = 12 }) {
  return (
    <span
      className="concept-dot"
      title={LEVEL_TITLES[level] ?? ""}
      style={{
        width:  size,
        height: size,
        background: LEVEL_COLORS[level] ?? LEVEL_COLORS[0],
      }}
    />
  );
}
