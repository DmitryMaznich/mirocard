import { useMemo, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import SheetSvg from "./SheetSvg";
import Inspector from "./Inspector";
import BlockPicker from "./BlockPicker";
import PdfDialog from "./PdfDialog";
import { layoutTest, blanksOf, FORMATS } from "./layout.js";
import { newBlock, newId, newSeed, normalizeBlock, blockTitle } from "./blocks.js";
import { NARROW_QUERY, useFitScale, useMediaQuery } from "./hooks.js";
import {
  IconUndo, IconRedo, IconA4, IconA5, IconGrid, IconBigGrid, IconName, IconVideo, IconShuffle, IconTrash, IconPdf, IconSolve, IconChevUp, IconChevDown,
} from "./icons";

const THUMB_W = 116;
const ZOOMS = [1, 1.25, 1.5, 2];
const DOCK_KEY = "math_tests:dock-open";

function Tool({ label, caption, onClick, disabled, on, danger, children }) {
  return (
    <button type="button" className={`mt-tool${on ? " is-on" : ""}${danger ? " is-danger" : ""}`} aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={on === undefined ? undefined : on}>
      <span className="mt-tool-ico">{children}</span>
      <span className="mt-cap">{caption}</span>
    </button>
  );
}

// The editor of one test, laid out like the «Печатные буквы» constructor: header (back · name ·
// undo/redo), one tool bar (page settings · the block tier in blue · PDF · «Решать» · zoom), the pages
// as thumbnails on the left, the sheets in the middle, the selected block's panel on the right;
// on a phone the panel is docked at the bottom.
export default function Editor({ test, onChange, onUndo, onRedo, canUndo, canRedo, onBack, onSolve }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const canvasRef = useRef(null);
  const pageRefs = useRef([]);
  const [selectedId, setSelectedId] = useState(test.blocks[0]?.id ?? null);
  const [zoom, setZoom] = useState(1);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(() => { try { return window.localStorage.getItem(DOCK_KEY) !== "0"; } catch { return true; } });

  const layout = useMemo(() => layoutTest(test), [test]);
  const { grid } = layout;
  const fit = useFitScale(canvasRef, grid.w, grid.h, { fitHeight: !narrow, pad: narrow ? 16 : 40 });
  const scale = fit * zoom;
  const total = useMemo(() => blanksOf(layout).length, [layout]);

  const index = test.blocks.findIndex((b) => b.id === selectedId);
  const block = index >= 0 ? test.blocks[index] : null;
  const pageOfBlock = (id) => layout.pages.findIndex((p) => p.blocks.some((b) => b.block.id === id));

  const set = (fn, opts) => onChange((t) => ({ ...t, ...fn(t) }), opts);
  const setBlocks = (fn, opts) => onChange((t) => ({ ...t, blocks: fn(t.blocks) }), opts);
  const patchBlock = (patch, opts) => setBlocks((bs) => bs.map((b) => (b.id === selectedId ? normalizeBlock({ ...b, ...patch }) : b)), opts);

  function addBlock(type) {
    const b = newBlock(type);
    setBlocks((bs) => [...bs, b]);
    setSelectedId(b.id);
    requestAnimationFrame(() => {
      const el = canvasRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }
  function duplicate() {
    if (!block) return;
    const copy = { ...block, id: newId(), seed: newSeed() };
    setBlocks((bs) => [...bs.slice(0, index + 1), copy, ...bs.slice(index + 1)]);
    setSelectedId(copy.id);
  }
  function move(dir) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove() {
    if (!block) return;
    const neighbour = test.blocks[index + 1] ?? test.blocks[index - 1] ?? null;
    setBlocks((bs) => bs.filter((b) => b.id !== selectedId));
    setSelectedId(neighbour?.id ?? null);
  }
  const reseed = () => patchBlock({ seed: newSeed() });
  const reseedAll = () => setBlocks((bs) => bs.map((b) => ({ ...b, seed: newSeed() })));
  const toggleDock = () => setDockOpen((o) => { try { window.localStorage.setItem(DOCK_KEY, o ? "0" : "1"); } catch { /* */ } return !o; });
  const scrollToPage = (i) => pageRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const inspector = (
    <Inspector
      block={block}
      index={index}
      count={test.blocks.length}
      onPatch={patchBlock}
      onReseed={reseed}
      onDuplicate={duplicate}
      onMove={move}
      onRemove={remove}
      compact={narrow}
    />
  );

  const header = (
    <div className="screen-header mt-header">
      <button className="back-btn" onClick={onBack} aria-label="К списку контрольных"><BackArrowIcon /></button>
      <input className="mt-title-input" value={test.title} onChange={(e) => set(() => ({ title: e.target.value }), { typing: true })} placeholder="Без названия" aria-label="Название контрольной" />
      <button type="button" className="mt-hist" onClick={onUndo} disabled={!canUndo} aria-label="Отменить" title="Отменить"><IconUndo /></button>
      <button type="button" className="mt-hist" onClick={onRedo} disabled={!canRedo} aria-label="Вернуть" title="Вернуть"><IconRedo /></button>
      {narrow && <button type="button" className="mt-solve-btn mt-solve-btn--sm" onClick={onSolve} disabled={total === 0}>Решать</button>}
    </div>
  );

  // «Имя, дата»: the name and date lines at the top of the first page. On a phone it stands right after the
  // block tools — at the end of the sideways-scrolling strip nobody found it.
  const nameTool = <Tool label="Строки «Имя» и «Дата» сверху листа" caption="Имя, дата" on={test.nameLine} onClick={() => set((t) => ({ nameLine: !t.nameLine }))}><IconName /></Tool>;
  const pageTools = <>
    <Tool label="Формат А4" caption="А4" on={test.format === "a4"} onClick={() => set(() => ({ format: "a4" }))}><IconA4 /></Tool>
    <Tool label="Формат А5" caption="А5" on={test.format === "a5"} onClick={() => set(() => ({ format: "a5" }))}><IconA5 /></Tool>
    <Tool label="Клетка 5 мм" caption="Клетка" on={test.paper === "cell"} onClick={() => set(() => ({ paper: "cell" }))}><IconGrid /></Tool>
    <Tool label="Крупная клетка" caption="Крупная" on={test.paper === "bigcell"} onClick={() => set(() => ({ paper: "bigcell" }))}><IconBigGrid /></Tool>
    {!narrow && nameTool}
    <Tool label="Видеоприз после проверки на экране" caption="Видеоприз" on={test.videoPrize} onClick={() => set((t) => ({ videoPrize: !t.videoPrize }))}><IconVideo /></Tool>
  </>;
  const blockTools = <>
    <BlockPicker onPick={addBlock} />
    <Tool label="Другие примеры во всех блоках" caption="Перемешать" onClick={reseedAll} disabled={!test.blocks.length}><IconShuffle /></Tool>
    <Tool label="Удалить выбранный блок" caption="Удалить" danger onClick={remove} disabled={!block}><IconTrash /></Tool>
  </>;
  const pdfTool = <Tool label="Сохранить в PDF" caption="PDF" onClick={() => setPdfOpen(true)} disabled={!test.blocks.length}><IconPdf /></Tool>;
  const zoomEl = (
    <div className="mt-zoom" role="group" aria-label="Масштаб">
      <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Уменьшить">−</button>
      <button type="button" className="mt-zoom-pct" onClick={() => setZoom(1)} aria-label="Вписать">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS.at(-1)} aria-label="Увеличить">+</button>
    </div>
  );

  const canvas = (
    <div className="mt-canvas" ref={canvasRef} onClick={() => setSelectedId(null)}>
      {layout.pages.map((p, i) => (
        <div key={i} className="mt-page" ref={(el) => { pageRefs.current[i] = el; }}>
          <SheetSvg layout={layout} pageIndex={i} test={test} scale={scale} selectedBlockId={selectedId} onSelectBlock={setSelectedId} />
          {layout.pages.length > 1 && <span className="mt-page-no">Страница {i + 1} из {layout.pages.length}</span>}
        </div>
      ))}
      {test.blocks.length === 0 && <div className="mt-empty-hint">Лист пуст. «Блок» сверху добавляет задание.</div>}
    </div>
  );

  const pdf = pdfOpen && <PdfDialog test={test} layout={layout} onClose={() => setPdfOpen(false)} />;

  if (!narrow) {
    return (
      <div className="screen mt-root mt-editor mt-editor--desk" data-testid="math-tests-editor">
        {header}
        <div className="mt-bar" role="toolbar" aria-label="Инструменты">
          <div className="mt-bar-group" role="group" aria-label="Лист">{pageTools}</div>
          <span className="mt-sep" aria-hidden="true" />
          <div className="mt-bar-group mt-bar-group--block" role="group" aria-label="Блок">{blockTools}</div>
          <span className="mt-sep" aria-hidden="true" />
          {pdfTool}
          <span className="mt-fill" />
          {zoomEl}
          <button type="button" className="mt-solve-btn" onClick={onSolve} disabled={total === 0}><IconSolve />Решать на экране</button>
        </div>
        <div className="mt-desk">
          <div className="mt-thumbs">
            {layout.pages.map((p, i) => (
              <button key={i} type="button" className={`mt-thumb-btn${block && pageOfBlock(block.id) === i ? " is-current" : ""}`} onClick={() => scrollToPage(i)} aria-label={`Страница ${i + 1}`}>
                <span className="mt-thumb-no">{i + 1}</span>
                <span className="mt-thumb">
                  <SheetSvg layout={layout} pageIndex={i} test={test} scale={THUMB_W / grid.w} selectedBlockId={selectedId} />
                </span>
              </button>
            ))}
          </div>
          {canvas}
          <aside className="mt-side" aria-label="Настройки блока">{inspector}</aside>
        </div>
        <div className="mt-status" role="status">
          <span>{FORMATS[test.format].label} · страниц: <b>{layout.pages.length}</b></span>
          <span>Блоков: <b>{test.blocks.length}</b> · ответов: <b>{total}</b></span>
          <span className="mt-status-hint">Нажмите на блок на листе — справа его настройки</span>
        </div>
        {pdf}
      </div>
    );
  }

  return (
    <div className="screen mt-root mt-editor mt-editor--phone" data-testid="math-tests-editor">
      {header}
      <div className="mt-strip" role="toolbar" aria-label="Инструменты">
        <div className="mt-bar-group mt-bar-group--block" role="group" aria-label="Блок">{blockTools}</div>
        <span className="mt-sep" aria-hidden="true" />
        {nameTool}
        {pdfTool}
        <span className="mt-sep" aria-hidden="true" />
        {pageTools}
      </div>
      {canvas}
      <div className={`mt-dock${dockOpen ? "" : " is-folded"}`}>
        <button type="button" className="mt-dock-toggle" onClick={toggleDock} aria-expanded={dockOpen}>
          <span>{block ? <>Блок <b>{index + 1}</b> · {blockTitle(block)}</> : "Настройки блока"}</span>
          {dockOpen ? <IconChevDown /> : <IconChevUp />}
        </button>
        {dockOpen && <div className="mt-dock-body">{inspector}</div>}
      </div>
      {pdf}
    </div>
  );
}
