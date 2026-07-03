import { useEffect, useRef, useState, Fragment } from "react";
import { useAppStore } from "@/core/store";
import ShareWithStudentPanel from "@/features/session/ShareWithStudentPanel";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { parseRecipeTxt } from "../reading/parseRecipeTxt";
import {
  getRawRecipeTxt, pullRecipeKvFromServer,
  getShoppingOrder, saveShoppingOrder, applyShoppingOrder,
  getShoppingPlan, saveShoppingPlan,
  getShoppingHistory, saveShoppingHistory,
  getShoppingStores, saveShoppingStores,
  getShoppingCustomData, saveShoppingCustomData,
} from "@/core/groupStore";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import { BackArrowIcon, ForwardArrowIcon, ArrowUpSmallIcon, ArrowDownSmallIcon } from "@/shared/components/ArrowIcons";
import PinGateModal from "@/shared/components/PinGateModal";
import SHOPPING_TXT_EMBEDDED from "../../../../content/shopping/shopping.txt?raw";

// Parsed once at module load — always up-to-date from the current build
const EMBEDDED_STEPS = parseRecipeTxt(SHOPPING_TXT_EMBEDDED).filter(
  (s) => s.type === "checklist" || s.type === "action"
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function sName(step) { return step.text.replace(/:$/, "").trim(); }

const RU_DAYS   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const RU_MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function formatTodayRu() {
  const d = new Date();
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`;
}

function formatHistoryDate(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} • ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pluralItems(n) {
  const abs = Math.abs(n) % 100;
  const m = abs % 10;
  if (abs >= 11 && abs <= 19) return "товаров";
  if (m === 1) return "товар";
  if (m >= 2 && m <= 4) return "товара";
  return "товаров";
}

// ─── Store picker ──────────────────────────────────────────────────────────────

const DEFAULT_STORES = ["Меркатор", "Спар", "Лидл", "Хофер"];

function StorePicker({ storeList, onSelect, onSaveList, onBack }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState("");

  function startEdit(i) { setEditingIdx(i); setEditVal(storeList[i]); }
  function saveEdit() {
    if (!editVal.trim()) return;
    const next = storeList.map((s, i) => (i === editingIdx ? editVal.trim() : s));
    onSaveList(next);
    setEditingIdx(null);
  }
  function deleteStore(i) { onSaveList(storeList.filter((_, j) => j !== i)); }
  function saveAdd() {
    if (!addVal.trim()) return;
    onSaveList([...storeList, addVal.trim()]);
    setAddVal(""); setAdding(false);
  }

  return (
    <div className="session-body reading-body shopping-body">
      <div className="store-picker-header">
        {onBack && (
          <button className="shopping-back-btn" onClick={onBack} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
        )}
        <span className="store-picker-title">В какой магазин?</span>
      </div>

      <div className="store-picker-list">
        {storeList.map((s, i) => (
          editingIdx === i ? (
            <div key={i} className="store-row store-row--editing">
              <input
                className="store-edit-input"
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
              <button className="store-edit-ok" onClick={saveEdit} disabled={!editVal.trim()}>✓</button>
              <button className="store-edit-cancel" onClick={() => setEditingIdx(null)}>✕</button>
            </div>
          ) : (
            <div key={i} className="store-row">
              <button className="store-row-name" onClick={() => onSelect(s)}>{s}</button>
              <button className="store-row-edit" onClick={() => startEdit(i)} aria-label="Переименовать">✏️</button>
              <button className="store-row-delete" onClick={() => deleteStore(i)} aria-label="Удалить">×</button>
            </div>
          )
        ))}

        {adding ? (
          <div className="store-row store-row--editing">
            <input
              className="store-edit-input"
              autoFocus
              value={addVal}
              onChange={(e) => setAddVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveAdd()}
              placeholder="Название магазина"
            />
            <button className="store-edit-ok" onClick={saveAdd} disabled={!addVal.trim()}>✓</button>
            <button className="store-edit-cancel" onClick={() => { setAdding(false); setAddVal(""); }}>✕</button>
          </div>
        ) : (
          <button className="store-add-btn" onClick={() => setAdding(true)}>+ Добавить магазин</button>
        )}
      </div>

      <div className="store-picker-footer">
        <button className="store-skip-btn" onClick={() => onSelect(null)}>Без магазина</button>
      </div>
    </div>
  );
}

function printShoppingList(allItems, todayStr, store) {
  let listHtml = "";
  let prevCat = null;
  let prevSub = null;
  for (const { item, category, subgroup, note } of allItems) {
    if (category && category !== prevCat) {
      listHtml += `<li class="cat">${category}</li>`;
      prevSub = null;
    }
    if (subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, category)) {
      listHtml += `<li class="sub">${subgroup}</li>`;
    }
    listHtml += `<li class="item">&#9744;&nbsp;${item}${note ? ` <em>(${note})</em>` : ""}</li>`;
    prevCat = category;
    prevSub = subgroup;
  }
  const title = store ? `Список покупок для похода в ${store}` : "Список покупок";
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:18mm 22mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111}
h1{font-size:20pt;font-weight:900;text-transform:uppercase;margin:0 0 3pt;line-height:1.2}
.meta{font-size:11pt;color:#666;margin-bottom:3pt}
hr{border:none;border-top:1.5pt solid #bbb;margin:8pt 0}
ul{list-style:none}
li.cat{font-size:13pt;font-weight:900;color:#1a6a55;padding:7pt 0 2pt;margin-top:4pt;border-top:1pt solid #d0eae5}
li.cat:first-child{border-top:none;margin-top:0}
li.sub{font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#4a9a82;padding:2pt 8pt;margin:5pt 0 2pt;border-radius:3pt;display:inline-block}
li.item{font-size:13pt;padding:2.5pt 0 2.5pt 6pt;line-height:1.4}
li.item em{color:#555;font-style:normal}
</style></head><body>
<h1>${title}</h1>
<div class="meta">${todayStr}</div><hr>
<ul>${listHtml}</ul>
<script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});})</script>
</body></html>`;
  const win = window.open("about:blank", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
function planKey(name, ii) { return `${name}_${ii}`; }

function stripEmoji(s) { return s.replace(/^\S+\s+/, "").trim(); }
function isDupSubgroup(subgroup, categoryName) { return stripEmoji(subgroup) === categoryName; }

// Convert base steps + icons → custom data format (used when initialising edit mode)
function stepsToCustomData(steps, icons) {
  return {
    categories: steps.map((step, i) => {
      const name = sName(step);
      const icon = icons[i] ?? "📦";
      const subgroups = [];
      let curSg = null;
      let curItems = [];
      (step.items ?? []).forEach((item, ii) => {
        const sg = step.itemSubgroups?.[ii] ?? null;
        if (sg !== curSg) {
          if (curItems.length) subgroups.push({ name: curSg, items: curItems });
          curSg = sg; curItems = [item];
        } else { curItems.push(item); }
      });
      if (curItems.length) subgroups.push({ name: curSg, items: curItems });
      if (!subgroups.length) subgroups.push({ name: null, items: [] });
      return { id: `base_${name}`, name, icon, subgroups };
    }),
  };
}

// Convert custom data → steps format used internally for rendering
function customDataToSteps(customData) {
  return customData.categories.map((cat) => {
    const items = [];
    const itemSubgroups = [];
    for (const sg of cat.subgroups) {
      for (const item of sg.items) {
        items.push(item);
        itemSubgroups.push(sg.name ?? null);
      }
    }
    return { type: "checklist", text: `${cat.name}:`, items, itemSubgroups };
  });
}

// Adds items from rawSteps that are missing from customData (e.g. after deck update)
function mergeBaseIntoCustom(customData, rawSteps, rawIcons) {
  const existing = new Set();
  for (const cat of customData.categories) {
    for (const sg of cat.subgroups) {
      for (const item of sg.items) {
        existing.add(item.toLowerCase().trim());
      }
    }
  }
  const merged = JSON.parse(JSON.stringify(customData));
  let changed = false;
  rawSteps.forEach((step, ci) => {
    const catName = sName(step);
    const items = step.items ?? [];
    const subgroups = step.itemSubgroups ?? [];
    items.forEach((item, ii) => {
      if (existing.has(item.toLowerCase().trim())) return;
      let customCat = merged.categories.find(
        (c) => c.name.toLowerCase().trim() === catName.toLowerCase().trim()
      );
      if (!customCat) {
        customCat = { id: `base_${catName}`, name: catName, icon: rawIcons[ci] ?? "📦", subgroups: [{ name: null, items: [] }] };
        merged.categories.push(customCat);
      }
      const sgName = subgroups[ii] ?? null;
      let sg = customCat.subgroups.find((s) => s.name === sgName);
      if (!sg) { sg = { name: sgName, items: [] }; customCat.subgroups.push(sg); }
      sg.items.push(item);
      existing.add(item.toLowerCase().trim());
      changed = true;
    });
  });
  return { merged, changed };
}

async function loadShoppingData(topicId, task) {
  await pullRecipeKvFromServer().catch(() => {});
  const [savedOrder, savedPlan, customData] = await Promise.all([
    getShoppingOrder(topicId).catch(() => null),
    getShoppingPlan(topicId).catch(() => ({})),
    getShoppingCustomData(topicId).catch(() => null),
  ]);
  // Use embedded steps — always matches current build, no ZIP race condition
  const rawSteps = EMBEDDED_STEPS;
  const rawIcons = task.text?.categoryIcons ?? [];
  if (customData) {
    const { merged, changed } = mergeBaseIntoCustom(customData, rawSteps, rawIcons);
    if (changed) saveShoppingCustomData(topicId, merged).catch(() => {});
    const steps = customDataToSteps(merged);
    const categoryIcons = merged.categories.map((c) => c.icon);
    return { rawSteps, rawIcons, steps, categoryIcons, savedPlan: savedPlan ?? {}, customData: merged };
  }
  const { steps, categoryIcons } = applyShoppingOrder(rawSteps, rawIcons, savedOrder);
  return { rawSteps, rawIcons, steps, categoryIcons, savedPlan: savedPlan ?? {}, customData: null };
}

// ─── EmojiPicker ─────────────────────────────────────────────────────────────

const CAT_EMOJI = [
  "🥦","🥕","🧅","🧄","🍅","🥑","🥒","🥔","🌽","🫑","🥬","🌿",
  "🍎","🍊","🍋","🍌","🍇","🍓","🍒","🍑","🫐","🍍","🥭","🍈",
  "🥩","🍗","🥓","🌭","🥚","🧀","🥛","🧈",
  "🐟","🦐","🥫","🍞","🥐","🧇","🍬","🍫","🍪","🧁","☕","🧃",
  "🥤","🍺","🧴","🧹","🧺","🧻","🐾","🌾","🧂","🫙","📦","🛒",
];

function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="emoji-picker-overlay" onClick={onClose}>
      <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
        {CAT_EMOJI.map((e) => (
          <button key={e} className="emoji-picker-item" onClick={() => onSelect(e)}>{e}</button>
        ))}
      </div>
    </div>
  );
}

// ─── CategoryEditor ───────────────────────────────────────────────────────────

const BACK_ICON_SVG = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
    <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
    <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
    <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
  </svg>
);

function CategoryEditor({ category, onSave, onDelete, onBack }) {
  const [cat, setCat] = useState(() => JSON.parse(JSON.stringify(category)));
  const [showEmojiFor, setShowEmojiFor] = useState(null); // null | "cat" | sgIdx (number)
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(category.name);
  const [editingSg, setEditingSg] = useState(null); // { sgIdx, val } | null
  const [editingItem, setEditingItem] = useState(null); // { sgIdx, itemIdx, val } | null
  const [addingItemSg, setAddingItemSg] = useState(null); // sgIdx | null
  const [addingItemVal, setAddingItemVal] = useState("");
  const [addingSg, setAddingSg] = useState(false);
  const [addingSgVal, setAddingSgVal] = useState("");

  function mutate(fn) {
    setCat((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      onSave(next);
      return next;
    });
  }

  function saveNameBlur() {
    const t = nameVal.trim();
    if (t && t !== cat.name) mutate((c) => { c.name = t; });
    setEditingName(false);
  }

  function saveSgNameBlur(sgIdx) {
    if (!editingSg) return;
    const t = editingSg.val.trim();
    if (t) mutate((c) => { c.subgroups[sgIdx].name = t; });
    setEditingSg(null);
  }

  function saveItemBlur(sgIdx, itemIdx) {
    if (!editingItem) return;
    const t = editingItem.val.trim();
    if (t) mutate((c) => { c.subgroups[sgIdx].items[itemIdx] = t; });
    setEditingItem(null);
  }

  function addItem(sgIdx) {
    const t = addingItemVal.trim();
    if (t) mutate((c) => { c.subgroups[sgIdx].items.push(t); });
    setAddingItemSg(null);
    setAddingItemVal("");
  }

  function deleteItem(sgIdx, itemIdx) {
    mutate((c) => { c.subgroups[sgIdx].items.splice(itemIdx, 1); });
  }

  function moveItem(sgIdx, itemIdx, dir) {
    mutate((c) => {
      const arr = c.subgroups[sgIdx].items;
      const ni = itemIdx + dir;
      if (ni < 0 || ni >= arr.length) return;
      [arr[itemIdx], arr[ni]] = [arr[ni], arr[itemIdx]];
    });
  }

  function addSubgroup() {
    const t = addingSgVal.trim();
    if (t) mutate((c) => { c.subgroups.push({ name: t, items: [] }); });
    setAddingSg(false);
    setAddingSgVal("");
  }

  function deleteSubgroup(sgIdx) {
    mutate((c) => { c.subgroups.splice(sgIdx, 1); });
  }

  function moveSg(sgIdx, dir) {
    mutate((c) => {
      const ni = sgIdx + dir;
      if (ni < 0 || ni >= c.subgroups.length) return;
      [c.subgroups[sgIdx], c.subgroups[ni]] = [c.subgroups[ni], c.subgroups[sgIdx]];
    });
  }

  function handleEmojiSelect(emoji) {
    if (showEmojiFor === "cat") {
      mutate((c) => { c.icon = emoji; });
    } else if (typeof showEmojiFor === "number") {
      mutate((c) => {
        const sg = c.subgroups[showEmojiFor];
        const text = sg.name ? sg.name.replace(/^\S+\s+/, "").trim() : "";
        sg.name = text ? `${emoji} ${text}` : emoji;
        if (editingSg?.sgIdx === showEmojiFor) setEditingSg({ sgIdx: showEmojiFor, val: sg.name });
      });
    }
    setShowEmojiFor(null);
  }

  return (
    <div className="session-body reading-body shopping-body">
      <div className="cat-editor-header">
        <button className="shopping-back-btn" onClick={onBack} aria-label="Назад">{BACK_ICON_SVG}</button>
        <button className="cat-editor-icon-btn" onClick={() => setShowEmojiFor("cat")}>{cat.icon}</button>
        {editingName ? (
          <input
            className="cat-editor-name-input"
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveNameBlur}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
        ) : (
          <span className="cat-editor-name" onClick={() => { setEditingName(true); setNameVal(cat.name); }}>
            {cat.name || "Без названия"}
          </span>
        )}
        <button className="cat-editor-delete-btn" onClick={onDelete} aria-label="Удалить категорию">🗑</button>
      </div>

      <div className="cat-editor-body">
        {cat.subgroups.map((sg, sgIdx) => (
          <div key={sgIdx} className="cat-editor-subgroup">
            <div className="cat-editor-sg-header">
              <button className="cat-editor-sg-emoji-btn" onClick={() => setShowEmojiFor(sgIdx)} aria-label="Иконка подгруппы">
                {sg.name ? (sg.name.split(" ")[0]) : "📋"}
              </button>
              {editingSg?.sgIdx === sgIdx ? (
                <input
                  className="cat-editor-sg-name-input"
                  autoFocus
                  value={editingSg.val}
                  onChange={(e) => setEditingSg({ sgIdx, val: e.target.value })}
                  onBlur={() => saveSgNameBlur(sgIdx)}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                />
              ) : (
                <span
                  className={`cat-editor-sg-name${sg.name === null ? " cat-editor-sg-name--null" : ""}`}
                  onClick={() => sg.name !== null && setEditingSg({ sgIdx, val: sg.name })}
                >
                  {sg.name ?? "— без подгруппы —"}
                </span>
              )}
              <div className="cat-editor-sg-actions">
                <button className="cat-editor-arrow-btn" onClick={() => moveSg(sgIdx, -1)} disabled={sgIdx === 0}><ArrowUpSmallIcon /></button>
                <button className="cat-editor-arrow-btn" onClick={() => moveSg(sgIdx, 1)} disabled={sgIdx === cat.subgroups.length - 1}><ArrowDownSmallIcon /></button>
                {cat.subgroups.length > 1 && (
                  <button className="cat-editor-sg-del-btn" onClick={() => deleteSubgroup(sgIdx)} aria-label="Удалить подгруппу">×</button>
                )}
              </div>
            </div>

            <ul className="cat-editor-items">
              {sg.items.map((item, itemIdx) => (
                <li key={itemIdx} className="cat-editor-item">
                  {editingItem?.sgIdx === sgIdx && editingItem?.itemIdx === itemIdx ? (
                    <input
                      className="cat-editor-item-input"
                      autoFocus
                      value={editingItem.val}
                      onChange={(e) => setEditingItem({ ...editingItem, val: e.target.value })}
                      onBlur={() => saveItemBlur(sgIdx, itemIdx)}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    />
                  ) : (
                    <span className="cat-editor-item-name" onClick={() => setEditingItem({ sgIdx, itemIdx, val: item })}>
                      {item}
                    </span>
                  )}
                  <div className="cat-editor-item-actions">
                    <button className="cat-editor-arrow-btn" onClick={() => moveItem(sgIdx, itemIdx, -1)} disabled={itemIdx === 0}><ArrowUpSmallIcon /></button>
                    <button className="cat-editor-arrow-btn" onClick={() => moveItem(sgIdx, itemIdx, 1)} disabled={itemIdx === sg.items.length - 1}><ArrowDownSmallIcon /></button>
                    <button className="cat-editor-item-del-btn" onClick={() => deleteItem(sgIdx, itemIdx)} aria-label="Удалить">×</button>
                  </div>
                </li>
              ))}
            </ul>

            {addingItemSg === sgIdx ? (
              <div className="cat-editor-add-item-row">
                <input
                  className="cat-editor-item-input"
                  autoFocus
                  value={addingItemVal}
                  onChange={(e) => setAddingItemVal(e.target.value)}
                  onBlur={() => addItem(sgIdx)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addItem(sgIdx); setAddingItemSg(sgIdx); setAddingItemVal(""); } }}
                  placeholder="Название товара"
                />
              </div>
            ) : (
              <button className="cat-editor-add-item-btn" onClick={() => { setAddingItemSg(sgIdx); setAddingItemVal(""); }}>
                + Добавить товар
              </button>
            )}
          </div>
        ))}

        {addingSg ? (
          <div className="cat-editor-add-sg-row">
            <input
              className="cat-editor-sg-name-input"
              autoFocus
              value={addingSgVal}
              onChange={(e) => setAddingSgVal(e.target.value)}
              onBlur={addSubgroup}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              placeholder="Название подгруппы (можно начать с 🌾)"
            />
          </div>
        ) : (
          <button className="cat-editor-add-sg-btn" onClick={() => setAddingSg(true)}>+ Добавить подгруппу</button>
        )}
      </div>

      {showEmojiFor !== null && (
        <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiFor(null)} />
      )}
    </div>
  );
}

// ─── SortablePlanTile  (uses same shopping-tile CSS as reading renderer) ──────

function SortablePlanTile({ id, icon, name, count, editMode, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shopping-tile shopping-tile--sortable${count > 0 ? " shopping-tile--partial" : ""}${isDragging ? " shopping-tile--dragging" : ""}${editMode ? " shopping-tile--editable" : ""}`}
    >
      <span className="shopping-tile-drag-handle" {...attributes} {...listeners}>⠿</span>
      <span className="shopping-tile-icon">{icon}</span>
      <span className="shopping-tile-name">{name}</span>
      {count > 0 && <span className="shopping-tile-badge">{count}</span>}
      {editMode && (
        <div className="tile-edit-overlay">
          <button className="tile-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Редактировать">✏️</button>
          <button className="tile-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Удалить">×</button>
        </div>
      )}
    </div>
  );
}

// ─── PlanMode ─────────────────────────────────────────────────────────────────
// Uses the same shopping-* CSS classes as ShoppingListTask in reading renderer.

function PlanMode({ task, topicId, store, onGoToShop, onChangeStore, onExit }) {
  const adultPinHash    = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings   = useAppStore((s) => s.patchSettings);
  const isStudentPortal = useAppStore((s) => s.isStudentPortal);
  const activeModeId    = useAppStore((s) => s.activeModeId);
  const [showShare, setShowShare] = useState(false);

  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("grid"); // "grid" | "history" | "preview" | number
  const [editMode, setEditMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [customData, setCustomData] = useState(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { catId, catName, plannedCount }
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // { key, value } | null
  const [confirmClear, setConfirmClear] = useState(false);
  const rawStepsRef = useRef([]);
  const rawIconsRef = useRef([]);

  function noteFor(key) {
    const v = planned[key];
    return v && typeof v === "object" ? (v.note ?? "") : "";
  }

  function clearAll() {
    const next = {};
    setPlanned(next);
    saveShoppingPlan(topicId, next).catch(() => {});
    setConfirmClear(false);
  }

  function saveNote(key, rawValue) {
    const note = rawValue.trim();
    setPlanned((prev) => {
      const next = { ...prev };
      next[key] = note ? { note } : true;
      saveShoppingPlan(topicId, next).catch(() => {});
      return next;
    });
    setEditingNote(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  useEffect(() => {
    loadShoppingData(topicId, task).then(({ rawSteps, rawIcons, steps, categoryIcons, savedPlan, customData: cd }) => {
      rawStepsRef.current = rawSteps;
      rawIconsRef.current = rawIcons;
      setSteps(steps);
      setCategoryIcons(categoryIcons);
      setPlanned(savedPlan);
      setCustomData(cd);
    });
    getShoppingHistory(topicId).then(setHistory).catch(() => {});
  }, [topicId, task.text?.id, task.text?.file]);

  function toggleItem(step, ii) {
    const key = planKey(sName(step), ii);
    setPlanned((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      saveShoppingPlan(topicId, next).catch(() => {});
      return next;
    });
  }

  function plannedInStep(step) {
    const name = sName(step);
    return (step.items ?? []).filter((_, ii) => planned[planKey(name, ii)]).length;
  }

  const totalPlanned = steps.reduce((sum, s) => sum + plannedInStep(s), 0);

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = steps.map((s) => s.text);
    const oi = ids.indexOf(active.id), ni = ids.indexOf(over.id);
    if (oi < 0 || ni < 0) return;
    const ns = arrayMove(steps, oi, ni);
    const nc = arrayMove(categoryIcons, oi, ni);
    setSteps(ns);
    setCategoryIcons(nc);
    if (customData) {
      const nd = { ...customData, categories: arrayMove(customData.categories, oi, ni) };
      setCustomData(nd);
      saveShoppingCustomData(topicId, nd).catch(() => {});
    } else {
      saveShoppingOrder(topicId, ns.map(sName)).catch(() => {});
    }
  }

  async function handleLocalSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    try {
      const db = await getDb();
      await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    } catch {}
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  function enterEditMode() {
    let cd = customData;
    if (!cd) {
      cd = stepsToCustomData(rawStepsRef.current, rawIconsRef.current);
      setCustomData(cd);
      saveShoppingCustomData(topicId, cd).catch(() => {});
      setSteps(customDataToSteps(cd));
      setCategoryIcons(cd.categories.map((c) => c.icon));
    }
    setEditMode(true);
    setView("grid");
  }

  function exitEditMode() {
    setEditMode(false);
    setEditingCategoryId(null);
  }

  async function resetToDefault() {
    await saveShoppingCustomData(topicId, null).catch(() => {});
    setCustomData(null);
    setConfirmReset(false);
    setEditMode(false);
    setEditingCategoryId(null);
    const { rawSteps, rawIcons, steps: s, categoryIcons: ci, savedPlan: sp } = await loadShoppingData(topicId, task);
    rawStepsRef.current = rawSteps;
    rawIconsRef.current = rawIcons;
    setSteps(s);
    setCategoryIcons(ci);
    setPlanned(sp);
  }

  function handleCategoryEditorSave(updatedCat) {
    setCustomData((prev) => {
      const nd = { ...prev, categories: prev.categories.map((c) => c.id === updatedCat.id ? updatedCat : c) };
      saveShoppingCustomData(topicId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setCategoryIcons(nd.categories.map((c) => c.icon));
      return nd;
    });
  }

  function handleAddCategory() {
    const newCat = { id: `user_${Date.now()}`, name: "Новая категория", icon: "📦", subgroups: [{ name: null, items: [] }] };
    setCustomData((prev) => {
      const nd = { ...prev, categories: [...prev.categories, newCat] };
      saveShoppingCustomData(topicId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setCategoryIcons(nd.categories.map((c) => c.icon));
      return nd;
    });
    setEditingCategoryId(newCat.id);
  }

  function handleDeleteCategory(catId) {
    if (!catId || !customData) return;
    const cat = customData.categories.find((c) => c.id === catId);
    if (!cat) return;
    const allItems = cat.subgroups.flatMap((sg) => sg.items);
    const plannedCount = allItems.filter((_, ii) => planned[planKey(cat.name, ii)]).length;
    setDeleteConfirm({ catId, catName: cat.name, plannedCount });
  }

  function confirmDeleteCategory() {
    if (!deleteConfirm || !customData) return;
    const { catId, catName } = deleteConfirm;
    const cat = customData.categories.find((c) => c.id === catId);
    if (cat) {
      const newPlanned = { ...planned };
      cat.subgroups.flatMap((sg) => sg.items).forEach((_, ii) => {
        delete newPlanned[planKey(catName, ii)];
      });
      setPlanned(newPlanned);
      saveShoppingPlan(topicId, newPlanned).catch(() => {});
    }
    setCustomData((prev) => {
      const nd = { ...prev, categories: prev.categories.filter((c) => c.id !== catId) };
      saveShoppingCustomData(topicId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setCategoryIcons(nd.categories.map((c) => c.icon));
      return nd;
    });
    setDeleteConfirm(null);
    setEditingCategoryId(null);
  }

  // ── Category editor (edit mode) ────────────────────────────────────────────
  if (editMode && editingCategoryId !== null) {
    const cat = customData?.categories.find((c) => c.id === editingCategoryId);
    return (
      <>
        {cat && (
          <CategoryEditor
            category={cat}
            onSave={handleCategoryEditorSave}
            onDelete={() => handleDeleteCategory(editingCategoryId)}
            onBack={() => setEditingCategoryId(null)}
          />
        )}
        {deleteConfirm && (
          <div className="shopping-confirm-bar cat-editor-delete-bar">
            <span className="shopping-confirm-text">
              Удалить «{deleteConfirm.catName}»?{deleteConfirm.plannedCount > 0 && ` Снимет ${deleteConfirm.plannedCount} отмеченных.`}
            </span>
            <div className="shopping-confirm-actions">
              <button className="shopping-confirm-cancel" onClick={() => setDeleteConfirm(null)}>Нет</button>
              <button className="shopping-confirm-ok" onClick={confirmDeleteCategory}>Удалить</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (!editMode && typeof view === "number") {
    const step = steps[view];
    const items = step?.items ?? [];
    const name = sName(step);
    const icon = categoryIcons[view] ?? "📦";
    const pCount = plannedInStep(step);

    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-detail-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-detail-icon">{icon}</span>
          <span className="shopping-detail-title">{step?.text.replace(/:$/, "")}</span>
          <span className="shopping-detail-count">{pCount}/{items.length}</span>
          {view + 1 < steps.length && (
            <button className="shopping-next-btn" onClick={() => setView(view + 1)} aria-label="Следующая категория">
              <span>{categoryIcons[view + 1] ?? "📦"}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <ul className="shopping-items">
          {items.map((item, ii) => {
            const subs = step?.itemSubgroups;
            const subgroup = subs?.[ii] ?? null;
            const showSub = subgroup && subgroup !== (subs?.[ii - 1] ?? null) && !isDupSubgroup(subgroup, name);
            const key = planKey(name, ii);
            const isPlanned = !!planned[key];
            const note = noteFor(key);
            const isEditing = editingNote?.key === key;
            return (
              <Fragment key={ii}>
                {showSub && <li className="shopping-subgroup-header">{subgroup}</li>}
                <li
                  role="checkbox"
                  aria-checked={isPlanned}
                  className={`shopping-item${isPlanned ? " shopping-item--done" : ""}`}
                >
                  <span className="shopping-checkbox" onClick={() => toggleItem(step, ii)}>
                    {isPlanned ? "✓" : ""}
                  </span>
                  <span
                    className="shopping-item-body"
                    onClick={() => isPlanned ? setEditingNote({ key, value: note }) : toggleItem(step, ii)}
                  >
                    <span className="shopping-item-label">{item}</span>
                    {isPlanned && (
                      isEditing ? (
                        <input
                          className="shopping-item-note-input"
                          autoFocus
                          value={editingNote.value}
                          onChange={(e) => setEditingNote({ key, value: e.target.value })}
                          onBlur={() => saveNote(key, editingNote.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          placeholder="Заметка..."
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`shopping-item-note${note ? " shopping-item-note--set" : ""}`}>
                          {note || "+ заметка"}
                        </span>
                      )
                    )}
                  </span>
                  {!isPlanned && <span className="shopping-tap-hint">нажми</span>}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── History view ───────────────────────────────────────────────────────────
  if (!editMode && view === "history") {
    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-detail-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-detail-title">История списков</span>
        </div>
        <div className="shop-history-list">
          {history.length === 0 ? (
            <div className="shop-history-empty">История пока пуста</div>
          ) : history.map((entry) => (
            <div key={entry.id} className="shop-history-entry">
              <div className="shop-history-meta">
                <span className="shop-history-date">{entry.date}</span>
                {entry.store && <span className="shop-history-store">{entry.store}</span>}
                <span className="shop-history-count">{entry.count} {pluralItems(entry.count)}</span>
              </div>
              <button className="shop-history-restore" onClick={() => {
                setPlanned(entry.plan);
                saveShoppingPlan(topicId, entry.plan).catch(() => {});
                setView("grid");
              }}>Открыть</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Preview / print view ──────────────────────────────────────────────────
  if (!editMode && view === "preview") {
    const todayStr = formatTodayRu();
    const allItems = steps.flatMap((step) => {
      const name = sName(step);
      return (step.items ?? [])
        .map((item, ii) => {
          const key = planKey(name, ii);
          if (!planned[key]) return null;
          return {
            item,
            category: name,
            subgroup: step.itemSubgroups?.[ii] ?? null,
            note: noteFor(key),
          };
        })
        .filter(Boolean);
    });
    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-preview-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К категориям">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-preview-title">Список покупок</span>
        </div>
        <div className="shopping-preview-content">
          <div className="shopping-print-header">
            {store && <div className="shopping-preview-store">для похода в {store}</div>}
            <div className="shopping-preview-date">{todayStr}</div>
          </div>
          <div className="shopping-preview-separator" />
          <ul className="shopping-preview-items">
            {allItems.map(({ item, category, subgroup, note }, i) => {
              const prevCat = allItems[i - 1]?.category ?? null;
              const prevSub = allItems[i - 1]?.subgroup ?? null;
              return (
                <Fragment key={i}>
                  {category && category !== prevCat && (
                    <li className="shopping-preview-category">{category}</li>
                  )}
                  {subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, category) && (
                    <li className="shopping-preview-subgroup">{subgroup}</li>
                  )}
                  <li className="shopping-preview-item">
                    ☐&nbsp;{item}
                    {note && <em className="shopping-preview-note">&nbsp;({note})</em>}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
        <div className="shopping-actions">
          <button className="shopping-print-btn" onClick={() => printShoppingList(allItems, todayStr, store)}>
            🖨 Печать / PDF
          </button>
        </div>
      </div>
    );
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  return (
    <div className="session-body reading-body shopping-body">
      <div className="shopping-grid-header">
        <span>{editMode ? "Редактор категорий" : (totalPlanned > 0 ? `🛒 ${totalPlanned}` : "Что нужно купить?")}</span>
        <div className="shopping-grid-header-actions">
          {editMode ? (
            <button className="shopping-sort-done-btn" onClick={exitEditMode}>✓ Готово</button>
          ) : (
            <>
              <button className="shop-store-chip" onClick={onChangeStore} aria-label="Сменить магазин">
                {store || "🏪"}
              </button>
              {history.length > 0 && (
                <button className="shopping-clear-btn" onClick={() => setView("history")} aria-label="История">🕐</button>
              )}
              {totalPlanned > 0 && (
                <button className="shopping-clear-btn" onClick={() => setView("preview")} aria-label="Печать">🖨</button>
              )}
              {totalPlanned > 0 && (
                <button className="shopping-clear-btn" onClick={() => setConfirmClear(true)} aria-label="Очистить">🗑</button>
              )}
              {!isStudentPortal && (
                <>
                  <button className="shopping-clear-btn" onClick={() => setShowPinGate(true)} aria-label="Редактировать категории">✏️</button>
                  <button className="shopping-clear-btn" onClick={() => setShowShare(true)} aria-label="Отправить ученику">↗</button>
                </>
              )}
              {onExit && (
                <button className="shopping-exit-btn" onClick={onExit} aria-label="Выйти">✕</button>
              )}
            </>
          )}
        </div>
      </div>
      {showShare && (
        <ShareWithStudentPanel
          topicId={topicId}
          modeId={activeModeId}
          modeTitle="Список покупок"
          planData={Object.keys(planned).length > 0 ? planned : undefined}
          onClose={() => setShowShare(false)}
        />
      )}
      {editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.text)} strategy={rectSortingStrategy}>
            <div className="shopping-grid">
              {steps.map((step, si) => (
                <SortablePlanTile
                  key={step.text}
                  id={step.text}
                  icon={categoryIcons[si] ?? "📦"}
                  name={sName(step)}
                  count={plannedInStep(step)}
                  editMode={true}
                  onEdit={() => setEditingCategoryId(customData?.categories[si]?.id ?? null)}
                  onDelete={() => handleDeleteCategory(customData?.categories[si]?.id)}
                />
              ))}
              <button className="shopping-tile shopping-tile--add" onClick={handleAddCategory} aria-label="Добавить категорию">
                <span className="shopping-tile-icon">＋</span>
                <span className="shopping-tile-name">Добавить</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="shopping-grid">
          {steps.map((step, si) => {
            const count = plannedInStep(step);
            const total = (step.items ?? []).length;
            const allDone = count === total && total > 0;
            return (
              <button
                key={step.id ?? si}
                className={`shopping-tile${allDone ? " shopping-tile--done" : count > 0 ? " shopping-tile--partial" : ""}`}
                onClick={() => setView(si)}
              >
                <span className="shopping-tile-icon">{categoryIcons[si] ?? "📦"}</span>
                <span className="shopping-tile-name">{sName(step)}</span>
                {count > 0 && <span className="shopping-tile-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="shopping-actions">
        {editMode ? (
          <button className="shopping-reset-btn" onClick={() => setConfirmReset(true)}>Сбросить к стандартному</button>
        ) : totalPlanned > 0 ? (
          <button className="shop-go-btn" onClick={onGoToShop}>
            <ForwardArrowIcon size={16} /> В магазин ({totalPlanned})
          </button>
        ) : (
          <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        )}
      </div>

      {showPinGate && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={() => { setShowPinGate(false); enterEditMode(); }}
          onSetPin={handleLocalSetPin}
          onCancel={() => setShowPinGate(false)}
        />
      )}

      {editMode && confirmReset && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Сбросить все изменения и вернуть стандартный список?</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={resetToDefault}>Сбросить</button>
          </div>
        </div>
      )}

      {!editMode && confirmClear && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Очистить весь список?</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmClear(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={clearAll}>Да, очистить</button>
          </div>
        </div>
      )}

      {editMode && deleteConfirm && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">
            Удалить «{deleteConfirm.catName}»?{deleteConfirm.plannedCount > 0 && ` Снимет ${deleteConfirm.plannedCount} отмеченных.`}
          </span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setDeleteConfirm(null)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={confirmDeleteCategory}>Удалить</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ShopMode ─────────────────────────────────────────────────────────────────

function ShopMode({ task, topicId, store, onGoToPlan, onExit }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [planned, setPlanned] = useState({});
  const [done, setDone] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadShoppingData(topicId, task).then(({ steps, categoryIcons, savedPlan }) => {
      setSteps(steps);
      setCategoryIcons(categoryIcons);
      setPlanned(savedPlan);
      setIsLoaded(true);
    });
  }, [topicId, task.text?.id, task.text?.file]);

  function toggleDone(step, ii) {
    const key = planKey(sName(step), ii);
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const shoppingList = steps.map((step, si) => {
    const name = sName(step);
    const icon = categoryIcons[si] ?? "📦";
    const plannedItems = (step.items ?? [])
      .map((item, ii) => ({ item, ii, subgroup: step.itemSubgroups?.[ii] ?? null }))
      .filter(({ ii }) => planned[planKey(name, ii)]);
    return { step, name, icon, plannedItems };
  }).filter(({ plannedItems }) => plannedItems.length > 0);

  const totalPlanned = shoppingList.reduce((sum, { plannedItems }) => sum + plannedItems.length, 0);
  const totalDone = shoppingList.reduce((sum, { name, plannedItems }) =>
    sum + plannedItems.filter(({ ii }) => done[planKey(name, ii)]).length, 0);
  const allDone = totalPlanned > 0 && totalDone === totalPlanned;

  async function clearPlanAndGo() {
    if (Object.keys(planned).length > 0) {
      const now = new Date();
      const entry = {
        id: now.getTime(),
        date: formatHistoryDate(now),
        store: store ?? null,
        plan: { ...planned },
        count: Object.keys(planned).length,
      };
      try {
        const hist = await getShoppingHistory(topicId);
        await saveShoppingHistory(topicId, [entry, ...hist].slice(0, 5));
      } catch {}
    }
    saveShoppingPlan(topicId, {}).catch(() => {});
    setPlanned({});
    setDone({});
    onGoToPlan();
  }

  if (!isLoaded) return <div className="session-body reading-body shopping-body" />;

  // Empty state
  if (totalPlanned === 0) {
    return (
      <div className="session-body reading-body shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🛒</div>
          <div className="shop-state__title">Список пуст</div>
          <div className="shop-state__hint">Сначала составь список покупок</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onGoToPlan}>
            <BackArrowIcon size={16} /> Составить список
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (allDone) {
    return (
      <div className="session-body reading-body shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🎉</div>
          <div className="shop-state__title">Всё куплено!</div>
          <div className="shop-state__hint">{totalPlanned} продуктов{store ? ` • ${store}` : ""}</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onGoToPlan}>
            <BackArrowIcon size={16} /> К списку
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8, background: "#4caf90" }} onClick={clearPlanAndGo}>
            Начать новый список
          </button>
        </div>
      </div>
    );
  }

  const progress = totalPlanned > 0 ? (totalDone / totalPlanned) * 100 : 0;

  return (
    <div className="session-body reading-body shopping-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {totalPlanned}</span>
        {store && <span className="shop-store-label">{store}</span>}
        {onExit && (
          <button className="shopping-exit-btn" onClick={onExit} aria-label="Выйти">✕</button>
        )}
      </div>

      <ul className="shopping-items">
        {shoppingList.map(({ step, name, icon, plannedItems }) => {
          const catDone = plannedItems.every(({ ii }) => done[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? " shop-section-header--done" : ""}`}>
                <span>{icon}</span>
                <span>{step.text.replace(/:$/, "")}</span>
                {catDone && <span className="shop-section-check"> ✓</span>}
              </li>
              {plannedItems.map(({ item, ii, subgroup }, idx) => {
                const prevSub = idx > 0 ? plannedItems[idx - 1].subgroup : null;
                const showSub = subgroup && subgroup !== prevSub && !isDupSubgroup(subgroup, name);
                const isDone = !!done[planKey(name, ii)];
                const noteVal = planned[planKey(name, ii)];
                const note = noteVal && typeof noteVal === "object" ? (noteVal.note ?? "") : "";
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shopping-subgroup-header">{subgroup}</li>}
                    <li
                      role="checkbox"
                      aria-checked={isDone}
                      className={`shopping-item${isDone ? " shopping-item--done" : ""}`}
                      onClick={() => toggleDone(step, ii)}
                    >
                      <span className="shopping-checkbox">{isDone ? "✓" : ""}</span>
                      <span className="shopping-item-body">
                        <span className="shopping-item-label">{item}</span>
                        {note && <span className="shopping-item-note shopping-item-note--set">{note}</span>}
                      </span>
                      {!isDone && <span className="shopping-tap-hint">взял</span>}
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>

      <div className="shopping-actions">
        <button className="shopping-view-btn" onClick={onGoToPlan}>
          <BackArrowIcon size={16} /> К списку
        </button>
        <button className="shopping-close-btn" onClick={clearPlanAndGo}>
          Новый список
        </button>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function ShoppingRenderer({ task, topicId, onExit }) {
  const [modeView, setModeView] = useState("loading"); // "loading" | "storePicker" | "plan" | "shop"
  const [stores, setStores] = useState(null); // { current: string|null, list: string[] }
  const isStudentPortal = useAppStore((s) => s.isStudentPortal);

  useEffect(() => {
    // Determine the target view from the task type; fall back to "plan"
    const taskView = task?.type === "shop" ? "shop" : "plan";
    getShoppingStores(topicId).then((saved) => {
      const data = saved ?? { current: null, list: [...DEFAULT_STORES] };
      setStores(data);
      // Students skip the store picker and land directly on the assigned mode view
      setModeView(isStudentPortal ? taskView : (data.current !== null ? taskView : "storePicker"));
    }).catch(() => {
      setStores({ current: null, list: [...DEFAULT_STORES] });
      setModeView(isStudentPortal ? taskView : "storePicker");
    });
  }, [topicId, isStudentPortal, task?.type]);

  function persistStores(next) {
    setStores(next);
    saveShoppingStores(topicId, next).catch(() => {});
  }

  function handleStoreSelect(s) {
    persistStores({ ...stores, current: s });
    setModeView("plan");
  }

  function handleSaveList(list) {
    persistStores({ ...stores, list });
  }

  function handleChangeStore() { setModeView("storePicker"); }
  function switchToShop() { setModeView("shop"); }
  function switchToPlan() { setModeView("plan"); }

  if (modeView === "loading") return <div className="session-body reading-body shopping-body" />;

  if (modeView === "storePicker") return (
    <StorePicker
      storeList={stores?.list ?? DEFAULT_STORES}
      onSelect={handleStoreSelect}
      onSaveList={handleSaveList}
      onBack={stores?.current !== null ? switchToPlan : null}
    />
  );

  if (modeView === "plan") return (
    <PlanMode
      task={task} topicId={topicId}
      store={stores?.current}
      onGoToShop={switchToShop}
      onChangeStore={handleChangeStore}
      onExit={onExit}
    />
  );

  if (modeView === "shop") return (
    <ShopMode
      task={task} topicId={topicId}
      store={stores?.current}
      onGoToPlan={switchToPlan}
      onExit={onExit}
    />
  );

  return null;
}
