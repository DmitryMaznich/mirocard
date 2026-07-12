import { useState, useEffect, Fragment } from 'react';
import { useAppStore } from '@/core/store';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import {
  getRawRecipeTxt,
  getPlannerShopPlan, savePlannerShopPlan,
  getPlannerShopCustomData, savePlannerShopCustomData,
  getPlannerShopStores, savePlannerShopStores,
  getPlannerShopBought, savePlannerShopBought,
  getPlannerShopMenuKeys, savePlannerShopMenuKeys,
  savePlannerPutawayPlan,
  getPlannerProductZoneOverrides, savePlannerProductZoneOverrides, getPlannerZoneCustomizations,
} from '@/core/groupStore';
import { loadPlan, loadAllRecipes, resetShoppingData, archiveShoppingTrip, PANTRY_ITEMS } from './plannerApi.js';
import { getPlanRecipes, buildSelectedIngredientsSummary } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';
import { savePendingReceiptPhoto, markPendingReceiptSkipped, isPendingReceiptResolved, clearPendingPhotos } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import { getEffectiveZones, getZoneForProduct, ZONES } from './putawayLocations.js';
import ZonePickerSheet from './ZonePickerSheet.jsx';
import { BackArrowIcon, ForwardArrowIcon, ArrowUpSmallIcon, ArrowDownSmallIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

// ── helpers ────────────────────────────────────────────────────────────────────

function sName(step) { return step.text.replace(/:$/, '').trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }
// Hides a subgroup header that's just "🌾 <category name>" restating its
// own category. Must only strip the first word when it's actually an emoji
// (see firstTokenIsEmoji below) — otherwise a plain-text subgroup name
// whose *second* word happens to match the category ("Особые продукты" vs.
// category "продукты") would be falsely treated as a duplicate and its
// header hidden.
function isDupSub(sub, cat) {
  const parts = sub.trim().split(/\s+/);
  const rest = parts.length > 1 && firstTokenIsEmoji(parts[0]) ? parts.slice(1).join(' ').trim() : sub.trim();
  return rest === cat;
}

function noteFor(planned, key) {
  const v = planned[key];
  return v && typeof v === 'object' ? (v.note ?? '') : '';
}

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatTodayRu() {
  const RU_DAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const d = new Date();
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`;
}

// A subgroup's "icon" is just its name's first word — there's no dedicated
// icon field — so both stripping and displaying it must first check that
// the word is actually an emoji (via Extended_Pictographic) rather than
// blindly assuming it. Free-typed subgroup names ("Особые продукты", no
// emoji) are common — the add-subgroup field only *suggests* starting with
// one, it doesn't require it — and treating a plain first word as an emoji
// used to both truncate it out of the name and show it standalone in the
// icon-sized button next to the (still-prefixed) full name.
function firstTokenIsEmoji(s) {
  const first = s?.trim().split(/\s+/)[0] ?? '';
  return /\p{Extended_Pictographic}/u.test(first);
}

function stripEmoji(s) {
  const parts = s.trim().split(/\s+/);
  if (parts.length > 1 && firstTokenIsEmoji(parts[0])) return parts.slice(1).join(' ').trim();
  return s.trim();
}

function printShoppingList(allItems, todayStr, store) {
  let listHtml = '';
  let prevCat = null;
  let prevSub = null;
  for (const { item, category, subgroup, note } of allItems) {
    if (category && category !== prevCat) {
      listHtml += `<li class="cat">${category}</li>`;
      prevSub = null;
    }
    if (subgroup && subgroup !== prevSub && !isDupSub(subgroup, category)) {
      listHtml += `<li class="sub">${subgroup}</li>`;
    }
    listHtml += `<li class="item">&#9744;&nbsp;${item}${note ? ` <em>(${note})</em>` : ''}</li>`;
    prevCat = category;
    prevSub = subgroup;
  }
  const title = store ? `Список покупок для похода в ${store}` : 'Список покупок';
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
  const win = window.open('about:blank', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Store picker ────────────────────────────────────────────────────────────────

const DEFAULT_STORES = ['Меркатор', 'Спар', 'Лидл', 'Хофер'];

function StorePicker({ storeList, onSelect, onSaveList, onBack }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState('');

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
    setAddVal(''); setAdding(false);
  }

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        {onBack && (
          <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        )}
        <h1 className="planner-header__title">В какой магазин?</h1>
      </div>
      <div className="shopping-body">
        <div className="store-picker-list">
          {storeList.map((s, i) => (
            editingIdx === i ? (
              <div key={i} className="store-row store-row--editing">
                <input
                  className="store-edit-input"
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
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
                onKeyDown={(e) => e.key === 'Enter' && saveAdd()}
                placeholder="Название магазина"
              />
              <button className="store-edit-ok" onClick={saveAdd} disabled={!addVal.trim()}>✓</button>
              <button className="store-edit-cancel" onClick={() => { setAdding(false); setAddVal(''); }}>✕</button>
            </div>
          ) : (
            <button className="store-add-btn" onClick={() => setAdding(true)}>+ Добавить магазин</button>
          )}
        </div>
      </div>
      <div className="planner-footer">
        <button className="store-skip-btn" onClick={() => onSelect(null)}>Без магазина</button>
      </div>
    </div>
  );
}

// ── EmojiPicker ──────────────────────────────────────────────────────────────────

const CAT_EMOJI = [
  '🥦','🥕','🧅','🧄','🍅','🥑','🥒','🥔','🌽','🫑','🥬','🌿',
  '🍎','🍊','🍋','🍌','🍇','🍓','🍒','🍑','🫐','🍍','🥭','🍈',
  '🥩','🍗','🥓','🌭','🥚','🧀','🥛','🧈',
  '🐟','🦐','🥫','🍞','🥐','🧇','🍬','🍫','🍪','🧁','☕','🧃',
  '🥤','🍺','🧴','🧹','🧺','🧻','🐾','🌾','🧂','🫙','📦','🛒',
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

// ── CategoryEditor ───────────────────────────────────────────────────────────────

function CategoryEditor({ category, onSave, onDelete, onBack, zones, zoneOverrides, onZoneOverrideChange }) {
  const [cat, setCat] = useState(() => JSON.parse(JSON.stringify(category)));
  const [showEmojiFor, setShowEmojiFor] = useState(null); // null | "cat" | sgIdx (number)
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(category.name);
  const [editingSg, setEditingSg] = useState(null); // { sgIdx, val } | null
  const [editingItem, setEditingItem] = useState(null); // { sgIdx, itemIdx, val } | null
  const [addingItemSg, setAddingItemSg] = useState(null); // sgIdx | null
  const [addingItemVal, setAddingItemVal] = useState('');
  const [addingSg, setAddingSg] = useState(false);
  const [addingSgVal, setAddingSgVal] = useState('');
  const [zonePickerFor, setZonePickerFor] = useState(null); // { sgIdx, itemIdx } | null

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
    setAddingItemVal('');
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
    setAddingSgVal('');
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
    if (showEmojiFor === 'cat') {
      mutate((c) => { c.icon = emoji; });
    } else if (typeof showEmojiFor === 'number') {
      mutate((c) => {
        const sg = c.subgroups[showEmojiFor];
        const text = sg.name ? stripEmoji(sg.name) : '';
        sg.name = text ? `${emoji} ${text}` : emoji;
        if (editingSg?.sgIdx === showEmojiFor) setEditingSg({ sgIdx: showEmojiFor, val: sg.name });
      });
    }
    setShowEmojiFor(null);
  }

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <button className="cat-editor-icon-btn" onClick={() => setShowEmojiFor('cat')}>{cat.icon}</button>
        {editingName ? (
          <input
            className="cat-editor-name-input"
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveNameBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          />
        ) : (
          <span className="cat-editor-name" onClick={() => { setEditingName(true); setNameVal(cat.name); }}>
            {cat.name || 'Без названия'}
          </span>
        )}
        <button className="cat-editor-delete-btn" onClick={onDelete} aria-label="Удалить категорию">🗑</button>
      </div>

      <div className="shopping-body cat-editor-body">
        {cat.subgroups.map((sg, sgIdx) => (
          <div key={sgIdx} className="cat-editor-subgroup">
            <div className="cat-editor-sg-header">
              <button className="cat-editor-sg-emoji-btn" onClick={() => setShowEmojiFor(sgIdx)} aria-label="Иконка подгруппы">
                {sg.name && firstTokenIsEmoji(sg.name) ? sg.name.split(' ')[0] : '📋'}
              </button>
              {editingSg?.sgIdx === sgIdx ? (
                <input
                  className="cat-editor-sg-name-input"
                  autoFocus
                  value={editingSg.val}
                  onChange={(e) => setEditingSg({ sgIdx, val: e.target.value })}
                  onBlur={() => saveSgNameBlur(sgIdx)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                />
              ) : (
                <span
                  className={`cat-editor-sg-name${sg.name === null ? ' cat-editor-sg-name--null' : ''}`}
                  onClick={() => sg.name !== null && setEditingSg({ sgIdx, val: sg.name })}
                >
                  {sg.name ?? '— без подгруппы —'}
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
                      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                    />
                  ) : (
                    <span className="cat-editor-item-name" onClick={() => setEditingItem({ sgIdx, itemIdx, val: item })}>
                      {item}
                    </span>
                  )}
                  {(() => {
                    const zid = getZoneForProduct(cat.name, item, zoneOverrides);
                    const z = zones.find((zz) => zz.id === zid);
                    return (
                      <button
                        type="button"
                        className={`cat-editor-item-zone-chip${z ? '' : ' cat-editor-item-zone-chip--unset'}`}
                        onClick={() => setZonePickerFor({ sgIdx, itemIdx })}
                        aria-label="Место хранения"
                      >
                        {z ? z.icon : '❓'}
                      </button>
                    );
                  })()}
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
                  onKeyDown={(e) => { if (e.key === 'Enter') { addItem(sgIdx); setAddingItemSg(sgIdx); setAddingItemVal(''); } }}
                  placeholder="Название товара"
                />
              </div>
            ) : (
              <button className="cat-editor-add-item-btn" onClick={() => { setAddingItemSg(sgIdx); setAddingItemVal(''); }}>
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
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
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

      {zonePickerFor && (() => {
        const sg = cat.subgroups[zonePickerFor.sgIdx];
        const productName = sg.items[zonePickerFor.itemIdx];
        return (
          <ZonePickerSheet
            zones={zones}
            currentZoneId={getZoneForProduct(cat.name, productName, zoneOverrides)}
            title={`Место для «${productName}»`}
            onSelect={(zoneId) => {
              onZoneOverrideChange(productName, zoneId);
              setZonePickerFor(null);
            }}
            onClose={() => setZonePickerFor(null)}
          />
        );
      })()}
    </div>
  );
}

// ── SortablePlanTile (drag-reorder tile, used only in edit mode) ─────────────────

function SortablePlanTile({ id, icon, name, count, onEdit, onDelete }) {
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
      className={`shopping-tile shopping-tile--sortable${count > 0 ? ' shopping-tile--partial' : ''}${isDragging ? ' shopping-tile--dragging' : ''} shopping-tile--editable`}
    >
      <span className="shopping-tile-drag-handle" {...attributes} {...listeners}>⠿</span>
      <span className="shopping-tile-icon">{icon}</span>
      <span className="shopping-tile-name">{name}</span>
      {count > 0 && <span className="shopping-tile-badge">{count}</span>}
      <div className="tile-edit-overlay">
        <button className="tile-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label="Редактировать">✏️</button>
        <button className="tile-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Удалить">×</button>
      </div>
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────────

function PlanGrid({
  steps, icons, planned, customData, editMode, onNote,
  onDetail, onShop, onEditCategory, onDeleteCategory, onAddCategory, onDragEnd,
}) {
  const total = steps.reduce((s, step) => {
    const n = sName(step);
    return s + (step.items ?? []).filter((_, ii) => planned[planKey(n, ii)]).length;
  }, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  return (
    <div className="shopping-body">
      <div className="shopping-scroll">
        {/* The selected-items summary leads the page — reachable without any
            scroll — so adding one more item doesn't bury "Вот что нужно
            купить" under the full category grid again. The grid itself stays
            exactly as it was (2-column, everything visible) below it, since
            browsing/adding across all categories needs the overview a
            horizontal strip can't give — see plannerShoppingScreen commit
            history for the compact-strip attempt this replaced. */}
        {!editMode && <SelectedSummary steps={steps} icons={icons} planned={planned} onNote={onNote} />}

        {editMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={steps.map((s) => s.text)} strategy={rectSortingStrategy}>
              <div className="shopping-grid">
                {steps.map((step, si) => (
                  <SortablePlanTile
                    key={step.text}
                    id={step.text}
                    icon={icons[si] ?? '📦'}
                    name={sName(step)}
                    count={(step.items ?? []).filter((_, ii) => planned[planKey(sName(step), ii)]).length}
                    onEdit={() => onEditCategory(customData?.categories[si]?.id ?? null)}
                    onDelete={() => onDeleteCategory(customData?.categories[si]?.id)}
                  />
                ))}
                <button className="shopping-tile shopping-tile--add" onClick={onAddCategory} aria-label="Добавить категорию">
                  <span className="shopping-tile-icon">＋</span>
                  <span className="shopping-tile-name">Добавить</span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="shopping-grid">
            {steps.map((step, si) => {
              const n = sName(step);
              const count = (step.items ?? []).filter((_, ii) => planned[planKey(n, ii)]).length;
              const stepTotal = (step.items ?? []).length;
              const done = count === stepTotal && stepTotal > 0;
              return (
                <button
                  key={si}
                  className={`shopping-tile${done ? ' shopping-tile--done' : count > 0 ? ' shopping-tile--partial' : ''}`}
                  onClick={() => onDetail(si)}
                >
                  <span className="shopping-tile-icon">{icons[si] ?? '📦'}</span>
                  <span className="shopping-tile-name">{n}</span>
                  {count > 0 && <span className="shopping-tile-badge">{done ? '✓' : count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="shopping-actions">
        {editMode ? null : total > 0
          ? <button className="shop-go-btn" onClick={onShop}><ForwardArrowIcon size={16} /> В магазин ({total})</button>
          : <div className="shop-hint">Нажми на категорию, чтобы выбрать продукты</div>
        }
      </div>
    </div>
  );
}

// ── Note editing (shared by SelectedSummary and PlanDetail) ──────────────────

const NOTE_PRESETS = ['одна упаковка', 'одна штука', 'один килограмм', 'одна бутылка'];

// Quick-pick chips shown alongside a note's text input — tapping one fills
// the input with that preset (replacing whatever was there), but doesn't
// save or close the input, so it's still freely hand-editable afterward
// (add to it, replace it, or just tap away to confirm as-is). onMouseDown
// preventDefault keeps focus in the input instead of the chip stealing it —
// without it, the input's onBlur would fire and save the pre-preset value
// before the click handler ever runs.
function NotePresetChips({ onPick }) {
  return (
    <div className="note-preset-chips" onClick={(e) => e.stopPropagation()}>
      {NOTE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className="note-preset-chip"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

// ── Selected-items summary ("Вот что нужно купить"), grouped by category ────

function SelectedSummary({ steps, icons, planned, onNote }) {
  const [editingNote, setEditingNote] = useState(null); // { key, value } | null

  const groups = steps.map((step, si) => {
    const name = sName(step);
    const items = (step.items ?? [])
      .map((item, ii) => ({ item, key: planKey(name, ii) }))
      .filter(({ key }) => planned[key]);
    return { name, icon: icons[si] ?? '📦', items };
  }).filter(({ items }) => items.length > 0);

  if (groups.length === 0) return null;

  function saveNote(key, raw) {
    const note = raw.trim();
    onNote(key, note ? { note } : true);
    setEditingNote(null);
  }

  return (
    <div className="selected-summary">
      <h2 className="selected-summary__title">Вот что нужно купить</h2>
      {groups.map(({ name, icon, items }) => (
        <div key={name} className="cat-plate">
          <div className="cat-plate__banner">
            <span className="cat-plate__icon">{icon}</span>
            <span className="cat-plate__name">{name}</span>
          </div>
          {items.map(({ item, key }) => {
            const note = noteFor(planned, key);
            const isEditing = editingNote?.key === key;
            return (
              <div key={key} className="cat-plate__row">
                <div className="cat-plate__row-main">
                  <span className="cat-plate__row-name">{item}</span>
                  {isEditing ? (
                    <>
                      <input
                        className="cat-plate__note-input" autoFocus
                        value={editingNote.value}
                        onChange={(e) => setEditingNote({ key, value: e.target.value })}
                        onBlur={() => saveNote(key, editingNote.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        placeholder="Заметка…"
                      />
                      <NotePresetChips onPick={(preset) => setEditingNote({ key, value: preset })} />
                    </>
                  ) : (
                    <span className={`cat-plate__note${note ? ' cat-plate__note--set' : ''}`}>
                      {note || '+ заметка'}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    className="cat-plate__edit-btn"
                    onClick={() => setEditingNote({ key, value: note })}
                    aria-label="Заметка"
                  >
                    ✎
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function PlanDetail({ steps, icons, planned, idx, onToggle, onNote, onNext }) {
  const [editingNote, setEditingNote] = useState(null);
  const step = steps[idx];
  const items = step?.items ?? [];
  const name = sName(step);
  const pCount = items.filter((_, ii) => planned[planKey(name, ii)]).length;

  function saveNote(key, raw) {
    const note = raw.trim();
    onNote(key, note ? { note } : true);
    setEditingNote(null);
  }

  return (
    <div className="shopping-body">
      <div className="shopping-detail-header">
        <span className="shopping-detail-icon">{icons[idx] ?? '📦'}</span>
        <span className="shopping-detail-title">{step?.text.replace(/:$/, '')}</span>
        <span className="shopping-detail-count">{pCount}/{items.length}</span>
        {idx + 1 < steps.length && (
          <button className="shopping-next-btn" onClick={onNext}>
            <span>{icons[idx + 1] ?? '📦'}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <ul className="shopping-items">
        {items.map((item, ii) => {
          const subs = step?.itemSubgroups;
          const sub = subs?.[ii] ?? null;
          const showSub = sub && sub !== (subs?.[ii - 1] ?? null) && !isDupSub(sub, name);
          const key = planKey(name, ii);
          const isPlanned = !!planned[key];
          const note = noteFor(planned, key);
          const isEditing = editingNote?.key === key;
          return (
            <Fragment key={ii}>
              {showSub && <li className="shopping-subgroup-header">{sub}</li>}
              <li role="checkbox" aria-checked={isPlanned}
                className={`shopping-item${isPlanned ? ' shopping-item--done' : ''}`}
              >
                <span className="shopping-checkbox" onClick={() => onToggle(step, ii)}>
                  {isPlanned ? '✓' : ''}
                </span>
                <span className="shopping-item-body"
                  onClick={() => isPlanned ? setEditingNote({ key, value: note }) : onToggle(step, ii)}
                >
                  <span className="shopping-item-label">{item}</span>
                  {isPlanned && (
                    isEditing ? (
                      <span className="shopping-item-note-edit" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="shopping-item-note-input" autoFocus
                          value={editingNote.value}
                          onChange={(e) => setEditingNote({ key, value: e.target.value })}
                          onBlur={() => saveNote(key, editingNote.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          placeholder="Заметка…"
                        />
                        <NotePresetChips onPick={(preset) => setEditingNote({ key, value: preset })} />
                      </span>
                    ) : (
                      <span className={`shopping-item-note${note ? ' shopping-item-note--set' : ''}`}>
                        {note || '+ заметка'}
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

// ── Preview / print view ──────────────────────────────────────────────────────

function PreviewView({ steps, planned, store }) {
  const todayStr = formatTodayRu();
  const allItems = steps.flatMap((step) => {
    const name = sName(step);
    return (step.items ?? [])
      .map((item, ii) => {
        const key = planKey(name, ii);
        if (!planned[key]) return null;
        return { item, category: name, subgroup: step.itemSubgroups?.[ii] ?? null, note: noteFor(planned, key) };
      })
      .filter(Boolean);
  });

  return (
    <div className="shopping-body">
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
                {subgroup && subgroup !== prevSub && !isDupSub(subgroup, category) && (
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

// ── Shop (in-store) view ──────────────────────────────────────────────────────

function ShopView({ steps, icons, planned, store, bought, onToggleBought, onNewList, onBackToPlan, onPutaway, studentId }) {
  const list = steps.map((step, si) => {
    const name = sName(step);
    const icon = icons[si] ?? '📦';
    const items = (step.items ?? [])
      .map((item, ii) => ({ item, ii, sub: step.itemSubgroups?.[ii] ?? null }))
      .filter(({ ii }) => planned[planKey(name, ii)]);
    return { step, name, icon, items };
  }).filter(({ items }) => items.length > 0);

  const total = list.reduce((s, { items }) => s + items.length, 0);
  const totalDone = list.reduce((s, { name, items }) =>
    s + items.filter(({ ii }) => bought[planKey(name, ii)]).length, 0);
  const allDone = total > 0 && totalDone === total;
  const progress = total > 0 ? (totalDone / total) * 100 : 0;

  const [hasReceipt, setHasReceipt] = useState(null); // null = checking, false = missing, true = present

  useEffect(() => {
    if (!allDone) return;
    let cancelled = false;
    isPendingReceiptResolved(studentId).then((resolved) => { if (!cancelled) setHasReceipt(resolved); });
    return () => { cancelled = true; };
  }, [allDone, studentId]);

  function toggle(step, ii) {
    onToggleBought(planKey(sName(step), ii));
  }

  if (total === 0) return (
    <div className="shopping-body shop-center">
      <div className="shop-state">
        <div className="shop-state__icon">🛒</div>
        <div className="shop-state__title">Список пуст</div>
        <div className="shop-state__hint">Выбери продукты в списке покупок</div>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBackToPlan}>
          <BackArrowIcon size={16} /> Составить список
        </button>
      </div>
    </div>
  );

  if (allDone) {
    if (hasReceipt === null) return (
      <div className="shopping-body shop-center">Загрузка…</div>
    );

    if (!hasReceipt) return (
      <div className="shopping-body shop-center">
        <PhotoCaptureCard
          title="Сфотографируй чек"
          hint="Это подтвердит, что покупки сделаны"
          maxDim={1800}
          quality={0.82}
          onConfirm={async (blob) => {
            await savePendingReceiptPhoto(studentId, blob);
            setHasReceipt(true);
          }}
          onSkip={async () => {
            await markPendingReceiptSkipped(studentId);
            setHasReceipt(true);
          }}
          skipLabel="Без чека"
        />
      </div>
    );

    return (
      <div className="shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🎉</div>
          <div className="shop-state__title">Всё куплено!</div>
          <div className="shop-state__hint">{total} продуктов{store ? ` • ${store}` : ''}</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBackToPlan}>
            <BackArrowIcon size={16} /> К списку
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8, background: '#4caf90' }} onClick={onNewList}>
            Начать новый список
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onPutaway}>📦 Разложить продукты</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {total}</span>
        {store && <span className="shop-store-label">{store}</span>}
      </div>
      <ul className="shopping-items">
        {list.map(({ step, name, icon, items }) => {
          const catDone = items.every(({ ii }) => bought[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? ' shop-section-header--done' : ''}`}>
                <span>{icon}</span>
                <span>{step.text.replace(/:$/, '')}</span>
                {catDone && <span className="shop-section-check"> ✓</span>}
              </li>
              {items.map(({ item, ii, sub }, idx) => {
                const prevSub = idx > 0 ? items[idx - 1].sub : null;
                const showSub = sub && sub !== prevSub && !isDupSub(sub, name);
                const isDoneItem = !!bought[planKey(name, ii)];
                const note = noteFor(planned, planKey(name, ii));
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shopping-subgroup-header">{sub}</li>}
                    <li role="checkbox" aria-checked={isDoneItem}
                      className={`shopping-item${isDoneItem ? ' shopping-item--done' : ''}`}
                      onClick={() => toggle(step, ii)}
                    >
                      <span className="shopping-checkbox">{isDoneItem ? '✓' : ''}</span>
                      <span className="shopping-item-body">
                        <span className="shopping-item-label">{item}</span>
                        {note && <span className="shopping-item-note shopping-item-note--set">{note}</span>}
                      </span>
                      {!isDoneItem && <span className="shopping-tap-hint">взял</span>}
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>
      <div className="shopping-actions">
        <button className="shopping-view-btn" onClick={onBackToPlan}><BackArrowIcon size={16} /> К списку</button>
        <button className="shopping-close-btn" onClick={onNewList}>Новый список</button>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlannerShoppingScreen() {
  const setScreen    = useAppStore((s) => s.setScreen);
  const studentId    = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const plannerShoppingInitialMode = useAppStore((s) => s.plannerShoppingInitialMode);
  const setPlannerShoppingInitialMode = useAppStore((s) => s.setPlannerShoppingInitialMode);

  // modeView: 'loading' | 'storePicker' | 'plan' | 'shop'
  const [modeView, setModeView] = useState('loading');
  const [stores, setStores] = useState(null); // { current: string|null, list: string[] }

  // view within 'plan': 'grid' | number (detail idx) | 'preview'
  const [view, setView]    = useState('grid');
  const [loading, setLoading]   = useState(true);
  const [steps, setSteps]       = useState([]);
  const [icons, setIcons]       = useState([]);
  const [planned, setPlanned]   = useState({});
  const [bought, setBought]     = useState({});
  const [customData, setCustomData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { catId, catName, plannedCount }
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [zoneOverrides, setZoneOverrides] = useState({});
  const [effectiveZones, setEffectiveZones] = useState(ZONES);

  useEffect(() => {
    if (!studentId) return;
    // Normally lands directly on the catalog — the store picker is optional
    // and reachable any time via the 🏪 chip, never a mandatory gate. The
    // hub's "В магазин" card asks for the in-store checklist instead by
    // setting plannerShoppingInitialMode before navigating here; consumed
    // once, then cleared, so a later visit defaults back to the catalog.
    const initialMode = plannerShoppingInitialMode === 'shop' ? 'shop' : 'plan';
    if (plannerShoppingInitialMode) setPlannerShoppingInitialMode(null);
    getPlannerShopStores(studentId).then((saved) => {
      setStores(saved ?? { current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
    }).catch(() => {
      setStores({ current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
    });
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    Promise.all([
      getPlannerProductZoneOverrides(studentId),
      getPlannerZoneCustomizations(studentId),
    ]).then(([overridesData, customizations]) => {
      if (cancelled) return;
      setZoneOverrides(overridesData ?? {});
      setEffectiveZones(getEffectiveZones(customizations));
    });
    return () => { cancelled = true; };
  }, [studentId]);

  async function handleZoneOverrideChange(productName, zoneId) {
    const norm = productName.trim().toLowerCase();
    const next = { ...zoneOverrides, [norm]: zoneId };
    setZoneOverrides(next);
    await savePlannerProductZoneOverrides(studentId, next);
  }

  async function loadAndApply(forceRegen = false) {
    setLoading(true);
    if (!forceRegen) {
      const [savedCustom, savedPlan, savedBought, savedMenuKeys, currentPlan, allRecipes] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
        getPlannerShopBought(studentId),
        getPlannerShopMenuKeys(studentId),
        loadPlan(studentId),
        loadAllRecipes(topicRecords),
      ]);
      if (savedCustom) {
        // Re-sync with Меню's Дома/Купить decisions on every load — not
        // just the first generation — so a decision changed after this
        // list already existed (or after a recipe was added to or removed
        // from the menu) still lands here: newly-decided "buy" ingredients
        // get added (via the same fuzzy match first generation uses,
        // falling back to "Из меню"), and menu-managed items whose
        // ingredient left the menu entirely get cleaned up — without
        // touching custom categories/items, manually-checked items the
        // decisions don't mention, or anything already bought (see
        // syncDecisionsIntoShoppingData's bought-guard).
        const ingredientItems = currentPlan ? buildSelectedIngredientsSummary(currentPlan, allRecipes) : [];
        const { customData: syncedCustomData, planned: mergedPlanned, menuKeys: syncedMenuKeys } = currentPlan
          ? syncDecisionsIntoShoppingData(savedCustom, savedPlan ?? {}, savedMenuKeys ?? [], ingredientItems, currentPlan.ingredientDecisions ?? {}, savedBought ?? {})
          : { customData: savedCustom, planned: savedPlan ?? {}, menuKeys: savedMenuKeys ?? [] };
        setSteps(customDataToSteps(syncedCustomData));
        setIcons(syncedCustomData.categories.map((c) => c.icon));
        setPlanned(mergedPlanned);
        setBought(savedBought ?? {});
        setCustomData(syncedCustomData);
        setLoading(false);
        if (JSON.stringify(syncedCustomData) !== JSON.stringify(savedCustom)) {
          savePlannerShopCustomData(studentId, syncedCustomData).catch(() => {});
        }
        if (JSON.stringify(mergedPlanned) !== JSON.stringify(savedPlan ?? {})) {
          savePlannerShopPlan(studentId, mergedPlanned).catch(() => {});
        }
        if (JSON.stringify(syncedMenuKeys) !== JSON.stringify(savedMenuKeys ?? [])) {
          savePlannerShopMenuKeys(studentId, syncedMenuKeys).catch(() => {});
        }
        return;
      }
    }

    // Generate from current meal plan. Meal-type tags are purely
    // informational ("when to eat it") — every selected recipe contributes
    // to the shopping list regardless of whether (or how many times) it's
    // tagged, scaled to its own chosen portions (plan.selectedPortions),
    // defaulting to the recipe's own base/fixed portions when the stepper
    // was never touched.
    const plan = await loadPlan(studentId);
    if (!plan) { setLoading(false); return; }

    const planRecipes = getPlanRecipes(plan);
    const recipesWithContent = await Promise.all(
      planRecipes.map(async (textId) => {
        for (const record of topicRecords) {
          if (record.meta?.renderer !== 'reading') continue;
          const text = (record.texts ?? []).find((t) => t.id === textId);
          if (!text?.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (!content) continue;
          const { portions, fixedPortions } = parseRecipeMetadata(content);
          const portionMultiplier = fixedPortions || plan.selectedPortions?.[textId] || portions;
          return { textId, content, portionMultiplier };
        }
        return null;
      })
    );

    const items = applyIngredientDecisions(
      generateShoppingList(recipesWithContent.filter(Boolean), PANTRY_ITEMS),
      plan.ingredientDecisions
    );
    const { customData: newCustomData, plan: newPlan } = buildPlannerShoppingData(items);

    await savePlannerShopCustomData(studentId, newCustomData);
    await savePlannerShopPlan(studentId, newPlan);
    await savePlannerShopMenuKeys(studentId, Object.keys(newPlan));

    setSteps(customDataToSteps(newCustomData));
    setIcons(newCustomData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setBought((await getPlannerShopBought(studentId)) ?? {});
    setCustomData(newCustomData);
    setLoading(false);
  }

  useEffect(() => {
    // 'shop' also needs steps/customData/planned/bought loaded — the hub's
    // "В магазин" card can land here directly without ever visiting 'plan'
    // first (see the plannerShoppingInitialMode boot effect above).
    if (studentId && (modeView === 'plan' || modeView === 'shop')) loadAndApply();
  }, [studentId, modeView]);

  function persistStores(next) {
    setStores(next);
    savePlannerShopStores(studentId, next).catch(() => {});
  }

  function toggleItem(step, ii) {
    const key = planKey(sName(step), ii);
    setPlanned((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      savePlannerShopPlan(studentId, next).catch(() => {});
      return next;
    });
  }

  function saveNote(key, value) {
    setPlanned((prev) => {
      const next = { ...prev, [key]: value };
      savePlannerShopPlan(studentId, next).catch(() => {});
      return next;
    });
  }

  function toggleBought(key) {
    setBought((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      savePlannerShopBought(studentId, next).catch(() => {});
      return next;
    });
  }

  async function handleRegenerate() {
    await resetShoppingData(studentId);
    setConfirmReset(false);
    setView('grid');
    setEditMode(false);
    setEditingCategoryId(null);
    loadAndApply(true);
  }

  function clearAllChecks() {
    const next = {};
    setPlanned(next);
    setBought(next);
    savePlannerShopPlan(studentId, next).catch(() => {});
    savePlannerShopBought(studentId, next).catch(() => {});
    savePlannerPutawayPlan(studentId, next).catch(() => {});
    savePlannerShopMenuKeys(studentId, []).catch(() => {});
    setConfirmClear(false);
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const ids = steps.map((s) => s.text);
    const oi = ids.indexOf(active.id), ni = ids.indexOf(over.id);
    if (oi < 0 || ni < 0) return;
    const ns = arrayMove(steps, oi, ni);
    const nc = arrayMove(icons, oi, ni);
    setSteps(ns);
    setIcons(nc);
    if (customData) {
      const nd = { ...customData, categories: arrayMove(customData.categories, oi, ni) };
      setCustomData(nd);
      savePlannerShopCustomData(studentId, nd).catch(() => {});
    }
  }

  function handleCategoryEditorSave(updatedCat) {
    setCustomData((prev) => {
      const nd = { ...prev, categories: prev.categories.map((c) => c.id === updatedCat.id ? updatedCat : c) };
      savePlannerShopCustomData(studentId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setIcons(nd.categories.map((c) => c.icon));
      return nd;
    });
  }

  function handleAddCategory() {
    const newCat = { id: `user_${Date.now()}`, name: 'Новая категория', icon: '📦', subgroups: [{ name: null, items: [] }] };
    setCustomData((prev) => {
      const nd = { ...prev, categories: [...prev.categories, newCat] };
      savePlannerShopCustomData(studentId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setIcons(nd.categories.map((c) => c.icon));
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
      const newBought = { ...bought };
      cat.subgroups.flatMap((sg) => sg.items).forEach((_, ii) => {
        delete newPlanned[planKey(catName, ii)];
        delete newBought[planKey(catName, ii)];
      });
      setPlanned(newPlanned);
      setBought(newBought);
      savePlannerShopPlan(studentId, newPlanned).catch(() => {});
      savePlannerShopBought(studentId, newBought).catch(() => {});
    }
    setCustomData((prev) => {
      const nd = { ...prev, categories: prev.categories.filter((c) => c.id !== catId) };
      savePlannerShopCustomData(studentId, nd).catch(() => {});
      setSteps(customDataToSteps(nd));
      setIcons(nd.categories.map((c) => c.icon));
      return nd;
    });
    setDeleteConfirm(null);
    setEditingCategoryId(null);
  }

  async function handleNewListAfterShop() {
    await archiveShoppingTrip(studentId, stores?.current);
    // archiveShoppingTrip already copied whatever pending receipt/zone photos
    // (or skip markers) existed into this trip's permanent record — clear the
    // pending ones now, or the next trip within the same cycle would see them
    // as still resolved and silently skip its own receipt/zone-photo prompts.
    await clearPendingPhotos(studentId);
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    await savePlannerShopMenuKeys(studentId, []);
    setPlanned({});
    setBought({});
    setModeView('plan');
    setView('grid');
  }

  function handleBack() {
    if (editMode && editingCategoryId !== null) { setEditingCategoryId(null); return; }
    if (editMode) { setEditMode(false); return; }
    if (typeof view === 'number' || view === 'preview') { setView('grid'); return; }
    setScreen('planner_menu');
  }

  if (modeView === 'loading' || stores === null) {
    return <div className="screen screen-center">Загрузка…</div>;
  }

  if (modeView === 'storePicker') {
    return (
      <StorePicker
        storeList={stores.list}
        onSelect={(s) => { persistStores({ ...stores, current: s }); setModeView('plan'); }}
        onSaveList={(list) => persistStores({ ...stores, list })}
        onBack={() => setModeView('plan')}
      />
    );
  }

  if (modeView === 'shop') {
    return (
      <div className="screen planner-screen">
        <div className="planner-header">
          <button className="planner-header__back" onClick={() => setModeView('plan')}><BackArrowIcon size={22} /></button>
          <h1 className="planner-header__title">В магазине</h1>
        </div>
        <ShopView
          steps={steps} icons={icons} planned={planned} store={stores.current}
          bought={bought} onToggleBought={toggleBought}
          onNewList={handleNewListAfterShop}
          onBackToPlan={() => setModeView('plan')}
          onPutaway={() => setScreen('planner_putaway')}
          studentId={studentId}
        />
      </div>
    );
  }

  // modeView === 'plan'
  if (loading) return <div className="screen screen-center">Составляем список…</div>;

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
            zones={effectiveZones}
            zoneOverrides={zoneOverrides}
            onZoneOverrideChange={handleZoneOverrideChange}
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

  const headerTitle =
    typeof view === 'number' ? null :
    view === 'preview' ? 'Список покупок' :
    editMode ? 'Редактор категорий' :
    'Список покупок';

  // The grid's own action icons (store/print/clear/edit/regenerate) live in
  // the same header row as the back arrow and title, rather than a second
  // header-styled row underneath — a "Список покупок" nav header immediately
  // followed by another header-styled row read as one screen with two title
  // bars stacked.
  const showGridActions = typeof view !== 'number' && view !== 'preview';
  const total = steps.reduce((s, step) => {
    const n = sName(step);
    return s + (step.items ?? []).filter((_, ii) => planned[planKey(n, ii)]).length;
  }, 0);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={handleBack}><BackArrowIcon size={22} /></button>
        {headerTitle && <h1 className="planner-header__title">{headerTitle}</h1>}
        {showGridActions && (
          editMode ? (
            <button
              className="planner-header-done-btn"
              onClick={() => { setEditMode(false); setEditingCategoryId(null); }}
            >
              ✓ Готово
            </button>
          ) : (
            <div className="planner-header-actions">
              <button className="shop-store-chip" onClick={() => setModeView('storePicker')} aria-label="Сменить магазин">{stores.current || '🏪'}</button>
              <button className="shopping-clear-btn" onClick={() => setEditMode(true)} aria-label="Редактировать категории">✏️</button>
              <button className="shopping-clear-btn" onClick={() => setShowActionsSheet(true)} aria-label="Ещё действия">⋯</button>
            </div>
          )
        )}
      </div>

      {typeof view === 'number' ? (
        <PlanDetail
          steps={steps} icons={icons} planned={planned}
          idx={view}
          onToggle={toggleItem}
          onNote={saveNote}
          onNext={() => setView(view + 1)}
        />
      ) : view === 'preview' ? (
        <PreviewView steps={steps} planned={planned} store={stores.current} />
      ) : (
        <PlanGrid
          steps={steps} icons={icons} planned={planned} customData={customData}
          editMode={editMode}
          onNote={saveNote}
          onDetail={setView}
          onShop={() => setModeView('shop')}
          onEditCategory={setEditingCategoryId}
          onDeleteCategory={handleDeleteCategory}
          onAddCategory={handleAddCategory}
          onDragEnd={handleDragEnd}
        />
      )}

      {showActionsSheet && (
        <div className="portions-sheet-backdrop" onClick={() => setShowActionsSheet(false)}>
          <div className="portions-sheet shop-actions-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="portions-sheet__handle" />
            {total > 0 && (
              <button
                type="button"
                className="shop-actions-sheet__item"
                onClick={() => { setView('preview'); setShowActionsSheet(false); }}
              >
                <span className="shop-actions-sheet__ic">🖨</span> Печать / PDF
              </button>
            )}
            <button
              type="button"
              className="shop-actions-sheet__item"
              onClick={() => { setConfirmReset(true); setShowActionsSheet(false); }}
            >
              <span className="shop-actions-sheet__ic">⟳</span> Пересобрать из рецептов
            </button>
            {total > 0 && (
              <button
                type="button"
                className="shop-actions-sheet__item shop-actions-sheet__item--danger"
                onClick={() => { setConfirmClear(true); setShowActionsSheet(false); }}
              >
                <span className="shop-actions-sheet__ic">🗑</span> Очистить весь список
              </button>
            )}
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Пересобрать список заново из текущего меню? Удалит все ваши изменения — добавленные и переименованные категории, свои товары — и все отметки «куплено». Вернётся только то, что есть в Меню.</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={handleRegenerate}>Да, пересобрать</button>
          </div>
        </div>
      )}

      {confirmClear && (
        <div className="shopping-confirm-bar">
          <span className="shopping-confirm-text">Снять все отметки «нужно купить» и «куплено»? Категории и товары останутся — исчезнут только галочки.</span>
          <div className="shopping-confirm-actions">
            <button className="shopping-confirm-cancel" onClick={() => setConfirmClear(false)}>Нет</button>
            <button className="shopping-confirm-ok" onClick={clearAllChecks}>Да, очистить</button>
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
