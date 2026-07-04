# Раскладка продуктов (planner putaway) — design

## Context

Mirocard's Planner trains independent-living skills through a staged flow: Рецепты (browse recipes) → Меню (schedule) → Покупки (shopping list, generated from recipes) → В магазине (check off items while shopping) → **Раскладка** (put groceries away by storage location) → back to Меню to cook. The first three stages are built; «Раскладка» is a placeholder today — a permanently `locked`, `disabled` 4th `HubCard` in `PlannerTab` (`src/features/home/HomeScreen.jsx:268-274`), labelled "После покупок".

This spec was written with Ekaterina (the app's speech/behavior therapist) describing the real-world skill it teaches: after a shopping trip, sort purchased products into the freezer, fridge, dry-goods cupboard, a room-temperature spot for root vegetables, a separate cupboard for household chemicals, and a table bowl for fruit that gets eaten quickly. The exercise mirrors what the family already does at home, so a correct sort has one right answer per product.

Existing building blocks this design reuses:
- `content/shopping/shopping.txt` — the 16 store-section categories with icons (`CATEGORY_ICONS` in `src/features/planner/plannerShoppingUtils.js`) that the shopping-list screens are built from.
- `PlannerShoppingScreen.jsx`'s `planned` state (`planKey(categoryName, itemIndex) → true | {note}`), persisted via `getPlannerShopPlan`/`savePlannerShopPlan` in `src/core/groupStore.js` — this is "selected to buy," decided in the grid/detail views.
- `PlannerShoppingScreen.jsx`'s `ShopView` — the "В магазине" checklist where the child taps items as "взял". Its `done` state is **local `useState` only**, lost on navigating away.

## Scope

In scope:
- A product → storage-zone mapping (`src/features/planner/putawayLocations.js`), covering every item currently in `shopping.txt`.
- Persisting the "взял" (bought) state from `ShopView`, since «Раскладка» needs to know what was actually bought.
- A new screen, `PlannerPutawayScreen.jsx` (`planner_putaway`), where the child sorts bought items one at a time into a storage zone, with mistake feedback and an escalating hint.
- Unlocking the 4th `HubCard` and adding a shortcut into the new screen from `ShopView`'s "all bought" celebration state.

Out of scope (explicit v1 simplifications, revisit later if needed):
- No link between raw meat/fish and today's `mealAssignments`. Ekaterina's fullest description ties meat/fish to what's cooking today (fridge) vs. everything else (freezer); v1 skips this and sends all raw meat/fish to the freezer by default, unconditionally.
- No per-family photos of the child's actual fridge/freezer/cupboards. Zones use generic icons, consistent with every other icon in the Planner today. Real-photo zones (with an upload/settings screen) is a candidate follow-up, not built here.
- Products with no category match (e.g. free-text ingredients from a recipe that didn't match any `shopping.txt` item, surfaced today as the "Из меню" catch-all category in `plannerShoppingUtils.js`) are simply excluded from the putaway list — there's no verified correct zone for them, and blocking the exercise on an unmappable item would be worse than skipping it.

## Design

### Storage zones

Six zones, generic icon + label (no per-family photos in v1):

| Zone id | Label | Icon |
|---|---|---|
| `freezer` | Морозилка | ❄️ |
| `fridge` | Холодильник | 🧊 |
| `pantry` | Шкаф | 🌾 |
| `veg` | Место для овощей | 🥔 |
| `chem` | Шкаф бытовой химии | 🧹 |
| `table` | Стол | 🍎 |

### Product → zone mapping (`putawayLocations.js`)

Mapping is **per-product accurate**, authored efficiently as a category default plus a short list of item-level overrides — not 150 duplicated entries, since most items in a category do share the same real-world storage spot:

| `shopping.txt` category | Default zone | Per-item overrides |
|---|---|---|
| Овощи | `fridge` | картошка, лук, чеснок, капуста → `veg` |
| Фрукты | `table` | — |
| Ягоды | `fridge` | — |
| Зелень | `fridge` | — |
| Бакалея | `pantry` | — |
| Мясо | `freezer` | — (v1 simplification, see Scope) |
| Рыба | `freezer` | — (v1 simplification, see Scope) |
| Гастрономия | `fridge` | — |
| Напитки | `pantry` | — |
| Молочные продукты | `fridge` | мороженое → `freezer` |
| Бытовая химия | `chem` | — |
| Сладости | `pantry` | — |
| Хлебобулочные изделия | `pantry` | — |
| Консервы | `pantry` | — |
| Заморозка | `freezer` | — |
| Товары для животных | `pantry` | — |

`getZoneForProduct(categoryName, productName)` checks the override table first (normalized lowercase match), then falls back to the category default. Returns `null` for anything not found in `shopping.txt` at all — the caller treats `null` as "exclude from putaway".

This file is new and independent from `shopping.txt`'s other consumer (`src/topics/renderers/shopping/index.jsx`, the standalone "Список покупок" card-deck topic) — it doesn't touch that file's content or its category data, only adds a new lookup keyed on the same category/item names.

### Persisting "bought" state

`ShopView`'s `done` state (which items were physically picked up in-store) becomes persisted, mirroring the existing `plannerShopPlanKey` pattern in `src/core/groupStore.js`:

```js
const plannerShopBoughtKey = (sid) => `planner_shop_bought_${sid}`;
export async function getPlannerShopBought(studentId) { … }   // -> { [planKey]: true } | {}
export async function savePlannerShopBought(studentId, bought) { … }
```

`PlannerShoppingScreen.jsx` loads this alongside `planned`/custom data on mount, and `ShopView`'s `toggle()` writes through to it (same fire-and-forget `.catch(() => {})` pattern already used by `toggleItem`/`saveNote`).

### Gating: when «Раскладка» unlocks

`PlannerTab` (`HomeScreen.jsx`): the 4th `HubCard` becomes `state="active"` (was permanently `locked`/`disabled`) as soon as the bought map has at least one entry — **not** 100% of the planned list. Value text: `"{n} товаров готово к раскладке"` when active, unchanged "После покупок" copy while still empty.

Additionally, `ShopView`'s "Всё куплено!" celebration state (`PlannerShoppingScreen.jsx:182-191`) gets a second button, `"📦 Разложить продукты"` → `setScreen('planner_putaway')`, so the child can flow straight into putaway without detouring through the hub. The hub card remains the other entry point (e.g. resuming later).

### `PlannerPutawayScreen.jsx` — one item at a time

Confirmed via the visual brainstorming session (browser mockups, two layouts compared): **one product at a time** ("Вариант B"), not an all-at-once grid of chips + zones. Rationale: fewer simultaneous decisions is easier for a child working on executive-function/attention skills, and progress is easier to track (`"Продукт 3 из 8"` + dot row) than scanning a shrinking tray.

Flow:
1. On mount, build the putaway list: read `getPlannerShopCustomData` + `getPlannerShopBought` for the student, resolve each bought `planKey` back to its category + product text (via the same `customDataToSteps` shape `PlannerShoppingScreen` already uses), map through `getZoneForProduct`, and drop any `null` (unmatched) results. Subtract items already present in the persisted putaway placements (see below) so re-entering the screen resumes where it left off, and include any newly-bought items that weren't there last time.
2. Item order follows the same order items appear across `shopping.txt` categories (i.e., the order they're already shown in in Покупки) — deterministic and predictable, not shuffled.
3. Big spotlight card: product name + the icon of its **source category** (already defined in `CATEGORY_ICONS`, e.g. Молочные продукты's 🥛) as a small decorative badge — no new per-product icon/photo asset needed.
4. Below: 2×3 grid of the six zone tiles (icon + label), tap to answer.
5. **Correct**: card advances to the next item, its dot fills in, `savePlannerPutawayPlan` writes the placement.
   **Incorrect**: the tapped zone shakes/flashes red briefly, a small hint line appears ("Не совсем — попробуй другое место"), no penalty, same item stays up, unlimited retries.
   **After 2 consecutive wrong taps on the same item**: the correct zone starts a soft pulsing highlight (glow, no color-coding of "right answer" beyond the zone's own accent color) and the hint line changes to "Вот сюда — попробуй эту зону". This resets to 0 when the item changes.
6. When the last item is placed: celebration state mirroring `ShopView`'s "Всё куплено!" pattern — 🎉, "Всё разложено!", back button to the hub.

### Persisting putaway progress

New storage, same shape family as the other planner-shop keys:

```js
const plannerPutawayPlanKey = (sid) => `planner_putaway_plan_${sid}`;
export async function getPlannerPutawayPlan(studentId) { … }   // -> { [planKey]: zoneId }
export async function savePlannerPutawayPlan(studentId, plan) { … }
```

Keyed by the same `planKey(categoryName, itemIndex)` used everywhere else in the shopping data, so no new identifier scheme is introduced.

### New screen registration

`src/App.jsx`: add `import PlannerPutawayScreen ...` and `planner_putaway: PlannerPutawayScreen` to the `SCREENS` map, following the existing `planner_summary`/`planner_shopping` pattern exactly.

## Testing

Manual verification via the `run` skill in the browser:
- Hub card stays locked/disabled with no bought items; becomes active after marking one item "взял" in ShopView, and after an app reload (i.e., bought state actually persisted).
- Opening «Раскладка» shows only bought items with a known zone, in `shopping.txt` category order; a bought item with no zone match (simulate by adding an unmatched "Из меню" extra) does not appear.
- Placing an item in the wrong zone twice, then correctly, advances the hint state and resets on the next item.
- Full run-through reaches the "Всё разложено!" celebration; re-entering the screen after partially completing it resumes from the right spot and doesn't re-show already-placed items.
- Buying more items later (after some putaway progress) surfaces the new items in the list without disturbing already-placed ones.
