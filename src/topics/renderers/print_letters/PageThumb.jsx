import LetterBlock from "./LetterBlock";

const SCALE = 0.17; // shrinks a real page (~480px content width) down to thumbnail size

// Non-interactive miniature of a page — reuses the real LetterBlock markup
// at a CSS scale rather than a separate drawing, so the thumbnail always
// matches what the page actually contains (propis2's own Propis2Thumbs does
// the same: a real render, not a schematic icon).
export default function PageThumb({ page, byId, active, index, onSelect }) {
  return (
    <button type="button" className={`pl-thumb${active ? " is-active" : ""}`} onClick={onSelect}>
      <span className="pl-thumb-num">{index + 1}</span>
      <span className="pl-thumb-sheet" aria-label={`Страница ${index + 1}`}>
        <span className="pl-thumb-scale" style={{ transform: `scale(${SCALE})` }}>
          {page.blocks.map((b) => (
            <LetterBlock
              key={b.id}
              letter={byId[b.letterId]}
              color={b.color}
              rows={b.rows}
              selected={false}
              selectedRowId={null}
              onSelectBlock={() => {}}
              onSelectRow={() => {}}
            />
          ))}
        </span>
      </span>
    </button>
  );
}
