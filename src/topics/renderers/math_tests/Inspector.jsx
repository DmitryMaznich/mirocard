import { BLOCK_KINDS, blockTitle, blockInstruction, buildBlock } from "./blocks.js";
import { IconShuffle, IconCopy, IconUp, IconDown, IconTrash } from "./icons";

function Field({ field, block, onPatch }) {
  const value = block[field.key];
  if (field.kind === "stepper") {
    return (
      <div className="mt-field">
        <span className="mt-field-label">{field.label}</span>
        <div className="mt-stepper">
          <button type="button" aria-label="Меньше" disabled={value <= field.min} onClick={() => onPatch({ [field.key]: value - 1 })}>−</button>
          <b aria-live="polite">{value}</b>
          <button type="button" aria-label="Больше" disabled={value >= field.max} onClick={() => onPatch({ [field.key]: value + 1 })}>+</button>
        </div>
      </div>
    );
  }
  if (field.kind === "toggle") {
    return (
      <label className="mt-field mt-field--toggle">
        <span className="mt-field-label">{field.label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onPatch({ [field.key]: e.target.checked })} />
      </label>
    );
  }
  const options = field.options(block);
  return (
    <div className="mt-field mt-field--seg">
      <span className="mt-field-label">{field.label}</span>
      <div className="mt-seg" role="radiogroup" aria-label={field.label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "is-on" : ""} onClick={() => onPatch({ [field.key]: o.value })}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// The panel of the selected block (right side; at the bottom on a phone): its name and instruction,
// then the settings its kind declares (blocks.js `fields`), then the block's own tools.
export default function Inspector({ block, index, count, onPatch, onReseed, onDuplicate, onMove, onRemove, compact = false }) {
  if (!block) {
    return (
      <div className="mt-insp mt-insp--empty">
        <p><b>Нажмите на блок на листе</b> — здесь появятся его настройки.</p>
        <p>«Блок» в панели сверху добавляет новое задание в конец контрольной.</p>
      </div>
    );
  }
  const kind = BLOCK_KINDS[block.type];
  const built = buildBlock(block);
  const answers = built.items.reduce((n, it) => n + it.answers.length, 0);
  return (
    <div className={`mt-insp${compact ? " mt-insp--compact" : ""}`}>
      <div className="mt-insp-head">
        <span className="mt-insp-no">{index + 1}</span>
        <div className="mt-insp-kind">
          <b>{kind.title}</b>
          <span>{built.items.length} заданий · {answers} ответов</span>
        </div>
      </div>
      <div className="mt-insp-acts" role="group" aria-label="Блок">
        <button type="button" onClick={onReseed} title="Другие примеры с теми же настройками"><IconShuffle /><span>Другие</span></button>
        <button type="button" onClick={onDuplicate} title="Копия блока"><IconCopy /><span>Копия</span></button>
        <button type="button" onClick={() => onMove(-1)} disabled={index <= 0} title="Выше"><IconUp /><span>Выше</span></button>
        <button type="button" onClick={() => onMove(1)} disabled={index >= count - 1} title="Ниже"><IconDown /><span>Ниже</span></button>
        <button type="button" className="is-danger" onClick={onRemove} title="Удалить блок"><IconTrash /><span>Удалить</span></button>
      </div>
      <label className="mt-text">
        <span className="mt-field-label">Название</span>
        <input value={block.title} placeholder={kind.title} onChange={(e) => onPatch({ title: e.target.value }, { typing: true })} />
      </label>
      <label className="mt-text">
        <span className="mt-field-label">Инструкция</span>
        <input value={block.instruction} placeholder={kind.instruction} onChange={(e) => onPatch({ instruction: e.target.value }, { typing: true })} />
      </label>
      {kind.fields.map((f) => <Field key={f.key} field={f} block={block} onPatch={onPatch} />)}
      <p className="mt-insp-note">На листе: «{blockTitle(block)}» — {blockInstruction(block).toLowerCase()}.</p>
    </div>
  );
}
