# Planner hub redesign (planner tab home screen)

## Context

Mirocard has a meal-planner sub-app for students learning independent living skills: browse recipes by category, build a cooking plan, generate a shopping list from that plan, check items off in-store, and (future, not yet built) put groceries away by storage location. This flow is gated: recipe browsing/instructions are always available; the shopping list only makes sense once the plan has recipes in it; the storage step only makes sense once shopping is done.

Today, entering the "Планировщик" tab on the home screen (`PlannerTab` in [HomeScreen.jsx:204-246](../../../src/features/home/HomeScreen.jsx)) shows a single ad-hoc card (`plan-card`, showing day/recipe counts, secondary button to the shopping summary) plus one primary CTA button ("Составить меню" / "Редактировать меню"). It doesn't visually represent the multi-stage flow or its gating.

Separately, the home screen's "Занятие" tab was recently redesigned (uncommitted work) around a `JourneyStep` component — numbered steps with `active`/`done`/`disabled` visual states, a warm cream/teal palette (`#4a9b8f` accent, `#f7f1e7`→`#f2ebe2` background gradient, `#263131` text), replacing an older blue/purple ad-hoc style still used elsewhere (e.g. `planner.css`'s `#5b5fc7`). This spec brings the planner tab's home view up to that same visual language.

## Scope

This spec covers **only** the visual/structural redesign of the planner tab's landing content (`PlannerTab`). It explicitly does not change:
- The recipe browsing / meal-slot-building flow inside `PlannerMenuScreen` (still meal-slot-first, as today).
- The shopping list screens (`PlannerShoppingScreen`, `PlannerSummaryScreen`).
- The plan data model (`day.meals[mealType]` stays an array of recipe text IDs; no per-recipe portions).
- Meal categories (`MEAL_TYPES` stays `['завтрак', 'обед', 'ужин', 'перекус']`, no "напитки").
- Persistence of "all items bought" state (currently ephemeral, local `useState` in `PlannerShoppingScreen`'s `ShopView`).

A follow-up spec will cover decoupling recipe browsing into its own always-available entry point (recipe-first flow: browse → view instructions → then choose meal slot + per-recipe portions), and building the actual storage/put-away screen with a real "all bought" gate. This spec deliberately stops short of those so the visual redesign can ship on its own.

## Design

### Where it lives

`PlannerTab` (HomeScreen.jsx:204-246) is rewritten in place. It remains the content shown when the "Планировщик" tab is active inside `HomeScreen` — no new screen, no new route, no `setScreen('planner_hub')`. The existing "no student selected" empty state (`home-tab-empty` + "Выбери ученика выше") is unchanged.

### Component reuse

The existing `JourneyStep` component (HomeScreen.jsx:116-134) — already used by `SessionTab` for the "Тема" / "Режим" steps — is reused as-is for the planner tab's three stages. Same file, same component, no new props needed: `state` (`active` | `done` | `disabled`), `number`, `label`, `value`, `onClick`. This keeps the two tabs visually and structurally consistent (same CSS classes: `.journey-step`, `.journey-steps` wrapper, etc. — already styled in `styles.css`).

### The three steps

Replacing today's `plan-card` + CTA button with three tappable `JourneyStep` rows, wrapped in the same `.journey-steps` container used by the session tab:

1. **«Меню»** (label) — always tappable, never disabled.
   - `state`: `"done"` if the plan has at least one recipe (`countPlanRecipes(existingPlan) > 0`), else `"active"`.
   - `value`: when done, `"{days} дн. · {count} рец."` (same numbers as today's `plan-card__meta`); when active/empty, `"Собери меню из рецептов"`.
   - `number`: `"1"`.
   - `onClick`: `() => setScreen('planner_menu')` — same target as today's CTA button, unconditionally (screen itself already handles both "start fresh" and "edit existing" cases).

2. **«Список покупок»** — gated on the plan having recipes.
   - `state`: `"active"` if `hasRecipes`, else `"disabled"`.
   - `value`: when active, `"Список готов — открой и отметь"`; when disabled, `"Сначала выбери рецепты"`.
   - `number`: `"2"`.
   - `onClick`: `() => setScreen('planner_summary')` when `hasRecipes` (same target as today's secondary button); `JourneyStep` already no-ops via its own `disabled` attribute when state is `"disabled"`, so no extra guard needed in the handler.

3. **«Раскладка»** — always disabled in this iteration (screen doesn't exist yet).
   - `state`: always `"disabled"`.
   - `value`: `"Появится, когда список покупок будет закрыт"`.
   - `number`: `"3"`.
   - `onClick`: no-op (`undefined` or empty function) — `JourneyStep` renders it non-interactive via its disabled styling regardless.

No separate CTA button remains below the steps — each row is fully clickable (as `JourneyStep` already behaves on the session tab), which is what yields the cleaner, more "graphical" look without extra chrome.

### Loading state

The existing `existingPlan === undefined` loading branch (HomeScreen.jsx:225-226, `"Загрузка…"`) is kept, shown in place of the three steps while the plan is being fetched from IndexedDB.

### What gets deleted

The `plan-card` / `plan-card__label` / `plan-card__meta` / `plan-card__actions` markup is removed from `PlannerTab`'s render. Confirmed via grep that `.plan-card` CSS in `planner.css` is only referenced from `HomeScreen.jsx`, so those CSS rules are deleted too rather than left as dead code.

## Testing

Manual verification via the `run` skill in the browser:
- No student selected → empty state unchanged.
- Student with no plan → step 1 shows `active` state with "Собери меню…", steps 2 and 3 disabled.
- Student with a plan containing recipes → step 1 shows `done` with day/recipe counts, step 2 becomes `active` and tappable to the shopping summary, step 3 stays disabled.
- Tapping step 1 always opens `PlannerMenuScreen`; tapping step 2 (when active) opens `PlannerSummaryScreen`; step 3 is inert.
- Visual check against the session tab's journey steps for consistent spacing/typography/palette.
