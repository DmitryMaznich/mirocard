# Topics Screen Redesign — Spec
Date: 2026-06-25

## Problem

The current Topics screen uses two equal-weight tabs ("Мои темы" / "Каталог"), but user tasks are not equal: ~80% of visits are to switch the active topic, ~20% to download new ones. The installed tab looks like a settings/management list (three icon buttons per row), not a picker. There is no obvious visual indication of which topic is currently active.

## Solution: Variant B — Single scrollable screen, no tabs

One unified screen with three logical zones stacked vertically. The catalog becomes a separate screen opened via a link, not a tab.

---

## Screen Structure

```
screen-header: ← Темы
─────────────────────────────────
ZONE 1: Active topic hero card
ZONE 2: "All topics" list (installed)  
ZONE 3: "From catalog" preview (updates + new)
─────────────────────────────────
```

---

## Zone 1 — Active Topic Hero

- Full-width card with tinted background (`#e8f5f3`)
- `TopicCover` size `large` (64px)
- Title (large, bold) + meta (version · concept count)
- "✓ Активна" green badge — not interactive
- Small `i` icon in the top-right corner → opens `InfoModal`
- **Not tappable** as a whole — already active
- When user selects a different topic from Zone 2: hero animates to new topic (cover + title fade/slide), previous topic reappears in Zone 2 list

---

## Zone 2 — All Topics List

### Row anatomy
```
[TopicCover medium 48px] [Title bold] [⋯ button]
                          [meta: version · count]
```

- **Tap anywhere on row** → `setActiveTopicId(id)` — topic moves to hero, this row is removed from list
- No navigation away — user stays on screen, sees confirmation in hero
- **Back button** on header → `setScreen("home")`

### Action button — three cases
| Type | Condition | UI | Actions |
|------|-----------|-----|---------|
| Builtin | `record.meta.builtin` | `i` icon only | О теме |
| First-party | `FIRST_PARTY_DECK_IDS.has(id)` | `⋯` | О теме, Аналитика |
| User-installed | otherwise | `⋯` | О теме, Аналитика, Удалить (red) |

### Import ZIP
- Small text link at bottom of Zone 2: "+ Импортировать файл"
- Renders existing `TopicImport` component

### Empty state
- If only builtin topics installed: show Zone 2 with builtins + a nudge "Скачайте темы из каталога ↓"

---

## Zone 3 — From Catalog Preview

Shown only if catalog is loaded AND there is something to show.

### Priority order
1. **Updates available** — amber chips `↑ v{version}`, tap → installs update
2. **New (uninstalled) topics** — up to 3 topics, green chips `↓ Скачать`
3. **"Открыть каталог →"** — always shown if zone is visible

### Hidden if
- Catalog not yet loaded (no loading spinner — zone simply absent)
- All catalog topics installed and up to date

### Catalog screen
- Existing `CatalogTopicItem` list with section headers (already implemented)
- Opened via `setScreen("catalog")`
- Back → returns to Topics screen

---

## Catalog Screen (extracted)

The current "Каталог" tab content becomes a standalone screen:
- Same grouped list by category (already built)
- Same action buttons (chip-style, already built)
- Header: "← Каталог" with refresh + update-all actions

---

## Component Changes

| Component | Change |
|-----------|--------|
| `TopicLibraryScreen` | Remove tabs; render 3 zones; extract catalog tab to new screen |
| `InstalledTopicItem` | Remove `onAnalytics` / `onDelete` / `onInfo` props; add `onMenu` → bottom sheet |
| New: `TopicActionSheet` | Bottom sheet with О теме / Аналитика / Удалить |
| New: `TopicHeroCard` | Hero card for active topic |
| `TopicLibraryScreen` (catalog) | Extract to `TopicCatalogScreen` |

---

## Animations

- Hero card topic change: `opacity` fade + slight `translateY` — CSS transition 200ms
- ⋯ sheet: standard bottom sheet slide-up

---

## Out of Scope

- Home screen changes
- Catalog screen internal layout changes (already done)
- Student portal tab separation
