# Shopping List Mode — Design Spec

**Date:** 2026-06-06  
**Status:** Approved  
**Deck:** reading_dad_texts (existing recipes deck)

## Summary

Add a new `shopping_list` mode to the existing reading/recipes deck. One `.txt` file with 14 categories of everyday goods. All categories shown at once as an accordion; student taps items to check them. Big "Печатать" button sends checked items to the browser print dialog as a clean PDF-ready list.

---

## 1. Content

**File:** `content/shopping/shopping.txt`  
**Format:** same as recipe `.txt` (parsed by existing `parseRecipeTxt`).  
`N. Category:` + `- item` lines → parsed to `{type:"checklist", text:"Category:", items:[...]}`.

14 categories:
1. Овощи (10 items)
2. Фрукты (7)
3. Зелень (6)
4. Бакалея (9)
5. Мясо (6)
6. Рыба (5)
7. Напитки (6)
8. Молочные продукты (8)
9. Бытовая химия (6)
10. Сладости (6)
11. Хлебобулочные изделия (5)
12. Консервы (6)
13. Заморозка (5)
14. Товары для животных (4)

**In topic.json (inside ZIP):**
```json
texts: [...existingTexts, {
  "id": "shopping_list",
  "kind": "shopping_list",
  "title": { "ru": "Список покупок", "en": "Shopping list" },
  "file": "shopping/shopping.txt"
}]

modes: [...existingModes, {
  "id": "shopping_list",
  "type": "shopping_list",
  "evaluation": "none",
  "ui": {
    "title": "Список в магазин",
    "instruction": "Отметь, что нужно купить, и распечатай список",
    "icon": "media/icons/reading_read.svg"
  }
}]
```

---

## 2. Engine (`reading/engine.js`)

Add case to `generateTasks`:
```js
case "shopping_list":
  return text.kind === "shopping_list" ? [{ type: "shopping_list", textId: text.id, text }] : [];
```

`topicLoader.js` DEFAULT_MODES.reading gets a new entry so the mode shows up even on fresh installs (icon fallback already handled by `ensureModeIcons`).

---

## 3. UI — ShoppingListTask component

**Location:** `reading/index.jsx` — new function `ShoppingListTask`, registered in `TASK_RENDERERS`.

**State:**
- `steps` — parsed checklist steps (loaded from `.txt` via same `useEffect` pattern as InstructionTask)
- `expanded: { [stepIndex]: bool }` — which categories are open
- `checked: { ["stepIndex_itemIndex"]: bool }` — ticked items

**Layout:**
```
┌─────────────────────────────┐
│  Список покупок              │  ← heading from txt (type:"heading")
├─────────────────────────────┤
│ ▶ Овощи          0/10      │  ← collapsed category
│ ▼ Фрукты         3/7  ✓   │  ← expanded
│   ✓ яблоки                  │
│   ✓ бананы                  │
│     апельсины  [нажми]      │
│ ▶ Зелень          0/6      │
│   ...                        │
├─────────────────────────────┤
│        🖨 Печатать           │  ← always visible at bottom
│           Готово             │
└─────────────────────────────┘
```

**Interactions:**
- Tap category header → toggle expand/collapse
- Tap item in expanded category → toggle checked
- "Печатать" → `window.print()`
- "Готово" → `onAdvance()`

**Progress indicator per category:** `N/total` checked items shown in header. Category header gets a visual "complete" style when all items checked.

---

## 4. Print

`@media print` CSS in reading CSS file:

- Hide everything except `.shopping-print-area`
- Show title + only categories that have ≥1 checked item
- Each checked item with a filled checkbox symbol (✓), unchecked items hidden
- Clean serif font, generous spacing

If no items checked → print all categories with empty checkboxes (full template).

---

## 5. ZIP rebuild

Script `update-recipes-deck.mjs` updated to:
1. Copy `content/shopping/shopping.txt` into ZIP as `shopping/shopping.txt`
2. Append shopping_list entry to `texts` manifest
3. Append shopping_list mode to `modes` manifest
4. Bump version (patch)
5. Update `catalog.json`

---

## Files changed

| File | Change |
|------|--------|
| `content/shopping/shopping.txt` | **new** |
| `scripts/update-recipes-deck.mjs` | add shopping list to ZIP build |
| `src/topics/topicLoader.js` | add `shopping_list` to DEFAULT_MODES.reading |
| `src/topics/renderers/reading/engine.js` | add `shopping_list` case |
| `src/topics/renderers/reading/index.jsx` | new `ShoppingListTask` component |
| `src/topics/renderers/reading/reading.css` (or inline) | shopping list styles + @media print |
| `npm run deploy:prod` | rebuild + deploy |
