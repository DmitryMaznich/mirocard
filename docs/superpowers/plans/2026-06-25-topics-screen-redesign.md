# Topics Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-tab Topics screen (Мои темы / Каталог) with a single scrollable screen: active-topic hero card + compact installer list + catalog preview, and extract the catalog into its own screen.

**Architecture:** Four independent changes in dependency order: (1) extract catalog content into `TopicCatalogScreen` and add it to the `SCREENS` map in App.jsx; (2) add `TopicHeroCard` component; (3) add `TopicActionSheet` bottom sheet; (4) refactor `TopicLibraryScreen` to use all three and render three zones with no tabs.

**Tech Stack:** React 18, Zustand (useAppStore), Vite, plain CSS, existing `TopicCover` / `Modal` / `InfoModal` / `Button` shared components.

## Global Constraints

- All user-facing copy stays in Russian.
- No new npm dependencies.
- `TopicCover` supports sizes: `small` (40 px), `medium` (64 px), `large` (100 px).
- Screen navigation uses `useAppStore((s) => s.setScreen)`.
- `setActiveTopicId(id)` is the only store setter needed to change the active topic.
- `FIRST_PARTY_DECK_IDS` is exported from `@/topics/builtinTopics` (currently an empty Set — import it for correctness).
- CSS additions go at the bottom of `src/styles.css` to avoid disrupting existing rules.
- Each task ends with `npm run build` succeeding (zero build errors).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/features/topics/TopicCatalogScreen.jsx` | Full catalog screen extracted from current tab |
| Create | `src/features/topics/TopicHeroCard.jsx` | Hero card for the currently active topic |
| Create | `src/features/topics/TopicActionSheet.jsx` | Bottom sheet with О теме / Аналитика / Удалить |
| Modify | `src/App.jsx` | Add `catalog: TopicCatalogScreen` to SCREENS map |
| Modify | `src/features/topics/TopicLibraryScreen.jsx` | Full refactor to single-screen three-zone layout |
| Modify | `src/styles.css` | Add hero card, action sheet, catalog preview CSS |

---

## Task 1: Extract catalog tab → TopicCatalogScreen + App.jsx route

**Files:**
- Create: `src/features/topics/TopicCatalogScreen.jsx`
- Modify: `src/App.jsx:57-76`

**Interfaces:**
- Produces: `TopicCatalogScreen` default export; uses `setScreen("topics")` to go back. `CATALOG_CATEGORIES` and `CATEGORY_ORDER` are **not exported** — they are also kept in `TopicLibraryScreen.jsx` for now (Task 4 removes them from there). Both files can define them until Task 4 is done.

- [ ] **Step 1: Create `src/features/topics/TopicCatalogScreen.jsx`**

```jsx
import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import TopicCover from "@/shared/components/TopicCover";
import Button from "@/shared/components/Button";
import { getTopicCatalogStatus } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  getImportErrorMessage,
  refreshInstalledCatalogTopics,
} from "./catalogService";

const CATALOG_CATEGORIES = {
  letter_writing:           "Чтение",
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  reading_dad_texts:        "Чтение",
  sentence_puzzle:          "Чтение",
  phrase_match_pilot:       "Чтение",
  vowel_consonant_ru:       "Чтение",
  magnetic_alphabet:        "Чтение",
  comparison:               "Математика",
  math_houses:              "Математика",
  addition_subtraction:     "Математика",
  column_addition:          "Математика",
  emotions_v2:              "Словарный запас",
  clothes_basic:            "Словарный запас",
  verbs_v2:                 "Словарный запас",
  transport_photo:          "Словарный запас",
  opposites:                "Словарный запас",
  tools_functions:          "Словарный запас",
  first_then:               "Практика",
  shopping_list:            "Практика",
  coffee:                   "Практика",
  chat_with_mom:            "Практика",
};
const CATEGORY_ORDER = ["Чтение", "Математика", "Словарный запас", "Практика"];

function CatalogTopicItem({ entry, topicRecords, onInstall, disabled = false }) {
  const status          = getTopicCatalogStatus(entry, topicRecords);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const installedRecord = topicRecords.find((r) => r.meta.id === entry.id);
  const avatarPath      = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(entry.id);

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      await onInstall(entry, { force: status !== "not_installed" });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const chipVariant = status === "not_installed" ? "install"
    : status === "update_available"              ? "update"
    : "sync";

  const chipLabel = loading                       ? "…"
    : status === "not_installed"                  ? "↓ Скачать"
    : status === "update_available"               ? `↑ v${entry.version}`
    : "↺ Синхр.";

  return (
    <li className="topic-item">
      <TopicCover topicId={entry.id} avatarPath={avatarPath} title={entry.title} size="medium" />
      <div className="topic-item__info">
        <div className="topic-item__title">{entry.title?.ru ?? entry.id}</div>
        <div className="topic-item__meta">
          v{entry.version}
          {status === "installed" && " · установлена"}
          {status === "update_available" && installedRecord?.meta?.version && ` · сейчас v${installedRecord.meta.version}`}
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
      <button
        className={`topic-action-chip topic-action-chip--${chipVariant}`}
        disabled={disabled || loading}
        onClick={handleDownload}
      >
        {chipLabel}
      </button>
    </li>
  );
}

export default function TopicCatalogScreen() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const setTopicRecords   = useAppStore((s) => s.setTopicRecords);
  const upsertTopicRecord = useAppStore((s) => s.upsertTopicRecord);
  const buildInfo         = useAppStore((s) => s.buildInfo);

  const [catalog,         setCatalog]         = useState(null);
  const [catalogLoading,  setCatalogLoading]  = useState(false);
  const [catalogErr,      setCatalogErr]      = useState("");
  const [catalogMessage,  setCatalogMessage]  = useState("");
  const [refreshingDecks, setRefreshingDecks] = useState(false);

  const loadCatalog = useCallback(async (force = false) => {
    setCatalogLoading(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const nextCatalog = await fetchCatalog(force);
      setCatalog(nextCatalog);
      if (force) setCatalogMessage("Каталог обновлён");
      return nextCatalog;
    } catch {
      setCatalogErr("Не удалось загрузить каталог");
      return null;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (catalog !== null) return;
    let cancelled = false;
    fetchCatalog(false)
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalogErr("Не удалось загрузить каталог"); });
    return () => { cancelled = true; };
  }, [catalog]);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
    upsertTopicRecord(record);
    return record;
  }, [buildInfo.version, upsertTopicRecord]);

  async function handleRefreshInstalledDecks() {
    setRefreshingDecks(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const result = await refreshInstalledCatalogTopics({
        topicRecords,
        appVersion: buildInfo.version,
        force: true,
      });
      setCatalog(result.catalog);
      if (result.updated.length === 0 && result.failed.length === 0) {
        setCatalogMessage("Нет установленных тем для обновления");
        return;
      }
      if (result.updated.length > 0) {
        setTopicRecords(result.nextRecords);
        const updated = result.updated.map(({ entry, record }) => `${entry.title?.ru ?? entry.id} v${record.meta.version}`);
        setCatalogMessage(`Обновлено: ${updated.join(", ")}`);
      }
      if (result.failed.length > 0) {
        const failed = result.failed.map(({ entry, error }) => `${entry.title?.ru ?? entry.id}: ${error}`);
        setCatalogErr(`Не обновлено: ${failed.join("; ")}`);
      }
    } catch {
      setCatalogErr("Не удалось обновить колоды с сервера");
    } finally {
      setRefreshingDecks(false);
    }
  }

  const grouped = catalog
    ? CATEGORY_ORDER
        .map((cat) => ({ label: cat, entries: catalog.decks.filter((e) => CATALOG_CATEGORIES[e.id] === cat) }))
        .filter((g) => g.entries.length > 0)
    : [];
  const uncategorized = catalog ? catalog.decks.filter((e) => !CATALOG_CATEGORIES[e.id]) : [];

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("topics")}>←</button>
        <h1 className="screen-title">Каталог тем</h1>
      </div>
      <div className="tab-content">
        <div className="catalog-actions">
          <Button variant="secondary" onClick={() => loadCatalog(true)} disabled={catalogLoading || refreshingDecks}>
            {catalogLoading ? "Проверяем…" : "Обновить каталог"}
          </Button>
          <Button variant="primary" onClick={handleRefreshInstalledDecks} disabled={catalogLoading || refreshingDecks || topicRecords.length === 0}>
            {refreshingDecks ? "Обновляем…" : "Обновить колоды с сервера"}
          </Button>
        </div>
        {catalogMessage && <div className="form-success">{catalogMessage}</div>}
        {catalogErr     && <div className="form-error" style={{ margin: 16 }}>{catalogErr}</div>}
        {!catalog && !catalogErr && (
          <div className="empty-state"><div className="empty-state__text">Загружаем каталог…</div></div>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="catalog-section">
            <div className="catalog-section-header">{group.label}</div>
            <ul className="topic-list">
              {group.entries.map((entry) => (
                <CatalogTopicItem key={entry.id} entry={entry} topicRecords={topicRecords} onInstall={installCatalogEntry} disabled={refreshingDecks} />
              ))}
            </ul>
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="catalog-section">
            <div className="catalog-section-header">Другое</div>
            <ul className="topic-list">
              {uncategorized.map((entry) => (
                <CatalogTopicItem key={entry.id} entry={entry} topicRecords={topicRecords} onInstall={installCatalogEntry} disabled={refreshingDecks} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register catalog screen in `src/App.jsx`**

In `src/App.jsx`, add the import after the `TopicLibraryScreen` import line (line 20):
```js
import TopicCatalogScreen from "@/features/topics/TopicCatalogScreen";
```

Then in the `SCREENS` object (around line 64), add after `topics: TopicLibraryScreen,`:
```js
  catalog: TopicCatalogScreen,
```

The final SCREENS object should look like:
```js
const SCREENS = {
  boot: BootScreen,
  login: LoginScreen,
  register: RegisterScreen,
  home: HomeScreen,
  students: StudentsScreen,
  student_edit: StudentEditScreen,
  topics: TopicLibraryScreen,
  catalog: TopicCatalogScreen,
  texts: TextPickerScreen,
  // ... rest unchanged
};
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no errors. Open `http://localhost:5173`, navigate to Topics → (still shows old tab UI). Navigate to a URL that would hit `catalog` screen — not yet reachable from UI, but build must pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/topics/TopicCatalogScreen.jsx src/App.jsx
git commit -m "feat(topics): extract catalog tab to TopicCatalogScreen, register screen"
```

---

## Task 2: TopicHeroCard component + CSS

**Files:**
- Create: `src/features/topics/TopicHeroCard.jsx`
- Modify: `src/styles.css` (append at end)

**Interfaces:**
- Produces: `TopicHeroCard({ record, onInfo })` — `record` is a topicRecord from the store (has `record.meta.id`, `record.meta.title`, `record.meta.avatar`, `record.meta.version`, `record.meta.conceptCount`, `record.meta.builtin`, `record.cards`), `onInfo(record)` opens InfoModal.
- Consumes: `TopicCover` from `@/shared/components/TopicCover`, `getTopicTitle` from `@/shared/utils/format`.

- [ ] **Step 1: Create `src/features/topics/TopicHeroCard.jsx`**

```jsx
import TopicCover from "@/shared/components/TopicCover";
import { getTopicTitle } from "@/shared/utils/format";

export default function TopicHeroCard({ record, onInfo }) {
  const isBuiltin = Boolean(record.meta.builtin);
  const meta = isBuiltin
    ? "встроенная"
    : `v${record.meta.version} · ${record.meta.conceptCount ?? record.cards.length} понятий`;

  return (
    <div className="topic-hero-card">
      <TopicCover
        topicId={record.meta.id}
        avatarPath={record.meta.avatar}
        title={record.meta.title}
        size="large"
      />
      <div className="topic-hero-card__body">
        <div className="topic-hero-card__title">{getTopicTitle(record.meta.title)}</div>
        <div className="topic-hero-card__meta">{meta}</div>
        <span className="topic-hero-card__badge">✓ Активна</span>
      </div>
      <button
        className="icon-btn icon-btn--info topic-hero-card__info-btn"
        onClick={() => onInfo(record)}
        aria-label="О теме"
      >
        i
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Append hero card CSS to `src/styles.css`**

Add at the end of the file:
```css
/* ── Topic Hero Card ─────────────────────────────────────── */
.topic-hero-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 16px;
  background: #e8f5f3;
  border-radius: 16px;
  margin: 12px 16px 4px;
}
.topic-hero-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.topic-hero-card__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a3a35;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topic-hero-card__meta {
  font-size: 0.78rem;
  color: #5a8a82;
}
.topic-hero-card__badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  background: #2a9d8f;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  width: fit-content;
  margin-top: 4px;
}
.topic-hero-card__info-btn {
  position: absolute;
  top: 10px;
  right: 10px;
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds. The component is not yet rendered anywhere — that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/features/topics/TopicHeroCard.jsx src/styles.css
git commit -m "feat(topics): add TopicHeroCard component with hero card CSS"
```

---

## Task 3: TopicActionSheet component + CSS

**Files:**
- Create: `src/features/topics/TopicActionSheet.jsx`
- Modify: `src/styles.css` (append at end)

**Interfaces:**
- Produces: `TopicActionSheet({ record, onClose, onInfo, onAnalytics, onDelete })` — bottom sheet. `onInfo(record)`, `onAnalytics(record)`, `onDelete(record)` are callbacks; sheet does NOT close itself (caller closes via `onClose` or callbacks trigger it). `onInfo`/`onAnalytics`/`onDelete` should be called and then `onClose()` separately.
- Consumes: `FIRST_PARTY_DECK_IDS` from `@/topics/builtinTopics`.

- [ ] **Step 1: Create `src/features/topics/TopicActionSheet.jsx`**

```jsx
import { FIRST_PARTY_DECK_IDS } from "@/topics/builtinTopics";
import { getTopicTitle } from "@/shared/utils/format";

export default function TopicActionSheet({ record, onClose, onInfo, onAnalytics, onDelete }) {
  const isBuiltin    = Boolean(record.meta.builtin);
  const isFirstParty = FIRST_PARTY_DECK_IDS.has(record.meta.id);
  const isDeletable  = !isBuiltin && !isFirstParty;

  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">{getTopicTitle(record.meta.title)}</div>
        <button
          className="action-sheet__item"
          onClick={() => { onInfo(record); onClose(); }}
        >
          О теме
        </button>
        {!isBuiltin && (
          <button
            className="action-sheet__item"
            onClick={() => { onAnalytics(record); onClose(); }}
          >
            Аналитика
          </button>
        )}
        {isDeletable && (
          <button
            className="action-sheet__item action-sheet__item--danger"
            onClick={() => { onDelete(record); onClose(); }}
          >
            Удалить
          </button>
        )}
        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append action sheet CSS to `src/styles.css`**

```css
/* ── Topic Action Sheet ──────────────────────────────────── */
.action-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  z-index: 200;
}
.action-sheet {
  width: 100%;
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 8px 0 max(env(safe-area-inset-bottom, 0px), 16px);
  animation: action-sheet-up 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes action-sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0);    }
}
.action-sheet__title {
  padding: 12px 20px 6px;
  font-size: 0.78rem;
  color: #8a9e9b;
  font-weight: 600;
}
.action-sheet__item {
  display: block;
  width: 100%;
  padding: 16px 20px;
  text-align: left;
  font-family: inherit;
  font-size: 1rem;
  background: none;
  border: none;
  border-top: 1px solid #f0f5f4;
  cursor: pointer;
  color: #1a3a35;
}
.action-sheet__item:active { background: #f0f5f4; }
.action-sheet__item--danger { color: #c0392b; }
.action-sheet__item--cancel {
  font-weight: 700;
  color: #5a8a82;
  border-top: 6px solid #f0f5f4;
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/topics/TopicActionSheet.jsx src/styles.css
git commit -m "feat(topics): add TopicActionSheet bottom sheet with slide-up animation"
```

---

## Task 4: Refactor TopicLibraryScreen to single-screen three-zone layout

**Files:**
- Modify: `src/features/topics/TopicLibraryScreen.jsx` (full rewrite)
- Modify: `src/styles.css` (append catalog preview + zone layout CSS)

**Interfaces:**
- Consumes:
  - `TopicHeroCard({ record, onInfo })` from `./TopicHeroCard`
  - `TopicActionSheet({ record, onClose, onInfo, onAnalytics, onDelete })` from `./TopicActionSheet`
  - `setScreen("catalog")` to open catalog
  - `setActiveTopicId(id)` — stays on screen, hero updates, no navigation
  - `setScreen("home")` — back button
- Produces: No exports change; `TopicLibraryScreen` remains the default export.

- [ ] **Step 1: Replace `src/features/topics/TopicLibraryScreen.jsx` with the new version**

```jsx
import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { getDb } from "@/core/db";
import { deleteTopicRecord } from "@/topics/topicLoader";
import TopicCover from "@/shared/components/TopicCover";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import TopicImport from "./TopicImport";
import InfoModal from "@/shared/components/InfoModal";
import TopicHeroCard from "./TopicHeroCard";
import TopicActionSheet from "./TopicActionSheet";
import { getTopicTitle, getTopicCatalogStatus } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  getImportErrorMessage,
} from "./catalogService";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";

function InstalledTopicItem({ record, onSelect, onMenu, onInfo }) {
  const isBuiltin = Boolean(record.meta.builtin);
  return (
    <li className="topic-item" onClick={() => onSelect(record)}>
      <TopicCover
        topicId={record.meta.id}
        avatarPath={record.meta.avatar}
        title={record.meta.title}
        size="medium"
      />
      <div className="topic-item__info">
        <div className="topic-item__title">{getTopicTitle(record.meta.title)}</div>
        <div className="topic-item__meta">
          {isBuiltin
            ? "встроенная"
            : `v${record.meta.version} · ${record.meta.conceptCount ?? record.cards.length} понятий`}
        </div>
      </div>
      {isBuiltin
        ? (
          <button
            className="icon-btn icon-btn--info"
            onClick={(e) => { e.stopPropagation(); onInfo(record); }}
            aria-label="О теме"
          >
            i
          </button>
        ) : (
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onMenu(record); }}
            aria-label="Действия"
          >
            ⋯
          </button>
        )}
    </li>
  );
}

function PreviewChip({ entry, topicRecords, onInstall, disabled, isUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const label = loading ? "…"
    : isUpdate ? `↑ v${entry.version}`
    : `↓ ${entry.title?.ru ?? entry.id}`;

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      await onInstall(entry, { force: isUpdate });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="catalog-preview__chip-wrap">
      <button
        className={`topic-action-chip topic-action-chip--${isUpdate ? "update" : "install"}`}
        disabled={disabled || loading}
        onClick={handleClick}
      >
        {label}
      </button>
      {error && <div className="form-error">{error}</div>}
    </span>
  );
}

function CatalogPreview({ catalog, topicRecords, onInstall, onOpenCatalog, disabled }) {
  if (!catalog) return null;

  const updates = catalog.decks.filter((e) => {
    const installed = topicRecords.find((r) => r.meta.id === e.id);
    return installed && installed.meta.version !== e.version;
  });
  const newTopics = catalog.decks
    .filter((e) => !topicRecords.find((r) => r.meta.id === e.id))
    .slice(0, 3);

  if (updates.length === 0 && newTopics.length === 0) {
    return (
      <div className="catalog-preview">
        <button className="catalog-preview__link" onClick={onOpenCatalog}>
          Открыть каталог →
        </button>
      </div>
    );
  }

  return (
    <div className="catalog-preview">
      <div className="catalog-section-header">Из каталога</div>
      <div className="catalog-preview__chips">
        {updates.map((entry) => (
          <PreviewChip
            key={entry.id}
            entry={entry}
            topicRecords={topicRecords}
            onInstall={onInstall}
            disabled={disabled}
            isUpdate
          />
        ))}
        {newTopics.map((entry) => (
          <PreviewChip
            key={entry.id}
            entry={entry}
            topicRecords={topicRecords}
            onInstall={onInstall}
            disabled={disabled}
            isUpdate={false}
          />
        ))}
      </div>
      <button className="catalog-preview__link" onClick={onOpenCatalog}>
        Открыть каталог →
      </button>
    </div>
  );
}

export default function TopicLibraryScreen() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const setTopicRecords   = useAppStore((s) => s.setTopicRecords);
  const upsertTopicRecord = useAppStore((s) => s.upsertTopicRecord);
  const buildInfo         = useAppStore((s) => s.buildInfo);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const setActiveTopicId  = useAppStore((s) => s.setActiveTopicId);
  const activeStudentId   = useAppStore((s) => s.activeStudentId);

  const [catalog,          setCatalog]          = useState(null);
  const [catalogLoading,   setCatalogLoading]   = useState(false);
  const [analyticsTarget,  setAnalyticsTarget]  = useState(null);
  const [deleting,         setDeleting]         = useState(null);
  const [infoTopic,        setInfoTopic]        = useState(null);
  const [actionSheetRecord, setActionSheetRecord] = useState(null);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
    upsertTopicRecord(record);
    return record;
  }, [buildInfo.version, upsertTopicRecord]);

  useEffect(() => {
    if (catalog !== null) return;
    let cancelled = false;
    fetchCatalog(false)
      .then((c)  => { if (!cancelled) setCatalog(c); })
      .catch(()  => {});
    return () => { cancelled = true; };
  }, [catalog]);

  async function handleDelete() {
    const db = await getDb();
    await deleteTopicRecord(db, deleting.meta.id);
    setTopicRecords(topicRecords.filter((r) => r.meta.id !== deleting.meta.id));
    setDeleting(null);
  }

  const activeRecord  = topicRecords.find((r) => r.meta.id === activeTopicId);
  const otherRecords  = topicRecords.filter((r) => r.meta.id !== activeTopicId);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Темы</h1>
      </div>

      <div className="topics-screen-body">
        {/* Zone 1: Hero — active topic */}
        {activeRecord && (
          <TopicHeroCard record={activeRecord} onInfo={setInfoTopic} />
        )}
        {!activeRecord && topicRecords.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__text">Нет установленных тем</div>
          </div>
        )}

        {/* Zone 2: All other topics */}
        {otherRecords.length > 0 && (
          <ul className="topic-list topics-zone-list">
            {otherRecords.map((record) => (
              <InstalledTopicItem
                key={record.meta.id}
                record={record}
                onSelect={(r) => setActiveTopicId(r.meta.id)}
                onMenu={setActionSheetRecord}
                onInfo={setInfoTopic}
              />
            ))}
          </ul>
        )}

        <TopicImport />

        {/* Zone 3: Catalog preview */}
        <CatalogPreview
          catalog={catalog}
          topicRecords={topicRecords}
          onInstall={installCatalogEntry}
          onOpenCatalog={() => setScreen("catalog")}
          disabled={catalogLoading}
        />
      </div>

      {/* Overlays */}
      {actionSheetRecord && (
        <TopicActionSheet
          record={actionSheetRecord}
          onClose={() => setActionSheetRecord(null)}
          onInfo={(r)      => { setInfoTopic(r); }}
          onAnalytics={(r) => setAnalyticsTarget({
            studentId:  activeStudentId,
            topicId:    r.meta.id,
            topicTitle: getTopicTitle(r.meta.title),
          })}
          onDelete={(r) => setDeleting(r)}
        />
      )}

      {infoTopic && (
        <InfoModal
          title={getTopicTitle(infoTopic.meta.title)}
          about={infoTopic.meta.about}
          modes={infoTopic.modes}
          onClose={() => setInfoTopic(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Удалить тему?"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>Отмена</Button>
              <Button variant="danger" onClick={handleDelete}>Удалить</Button>
            </>
          }
        >
          Удалить <strong>{getTopicTitle(deleting.meta.title)}</strong>? История сессий сохранится.
        </Modal>
      )}

      {analyticsTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#fff" }}>
          <AnalyticsScreen
            studentId={analyticsTarget.studentId}
            topicId={analyticsTarget.topicId}
            topicTitle={analyticsTarget.topicTitle}
            onClose={() => setAnalyticsTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append catalog preview + layout CSS to `src/styles.css`**

```css
/* ── Topics Screen Body ──────────────────────────────────── */
.topics-screen-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 32px;
}
.topics-zone-list {
  margin-top: 8px;
}

/* ── Catalog Preview (Zone 3) ────────────────────────────── */
.catalog-preview {
  padding: 8px 16px 4px;
}
.catalog-preview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.catalog-preview__chip-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}
.catalog-preview__link {
  background: none;
  border: none;
  padding: 4px 0;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: #4a9b8f;
  cursor: pointer;
  display: block;
  margin-top: 4px;
}
.catalog-preview__link:active { opacity: 0.7; }
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Smoke test in browser**

Start the dev server:
```bash
npm run dev
```

Open `http://localhost:5173`, log in, navigate to Topics. Verify:

1. **No tabs visible** — single scrollable screen
2. **Zone 1** — active topic hero card renders with green `#e8f5f3` background, large cover, `✓ Активна` badge, `i` button in corner
3. **Zone 2** — other topics listed; tapping any topic updates the hero immediately (no navigation away); builtin rows show `i` button, user topics show `⋯`
4. **⋯ bottom sheet** — tap `⋯` on a user topic → sheet slides up with О теме / Аналитика / Удалить; tap overlay → dismisses
5. **Zone 3** — "Из каталога" section visible if updates/new topics exist; chips trigger install; "Открыть каталог →" navigates to catalog screen and "← Каталог" goes back to topics
6. **TopicImport** — still present between Zone 2 and Zone 3
7. **Back button** `←` → navigates to home screen

- [ ] **Step 5: Commit**

```bash
git add src/features/topics/TopicLibraryScreen.jsx src/styles.css
git commit -m "feat(topics): redesign to single-screen layout — hero + list + catalog preview"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Remove tabs, single scrollable screen | Task 4 |
| Zone 1: hero card with `#e8f5f3`, `size="large"`, ✓ badge, `i` button | Task 2 |
| Tapping topic in Zone 2 → hero updates, stays on screen | Task 4 (setActiveTopicId only) |
| Back button → home | Task 4 |
| Zone 2: builtin → `i` only, first-party → `⋯` 2 items, user → `⋯` 3 items | Task 3 + 4 |
| ⋯ bottom sheet slide-up animation | Task 3 |
| Import ZIP link still present | Task 4 (TopicImport kept) |
| Empty state if no topics | Task 4 (handled) |
| Zone 3: updates amber chips, new topics green chips, hidden if nothing to show | Task 4 (CatalogPreview) |
| "Открыть каталог →" → setScreen("catalog") | Task 4 |
| Catalog screen back → setScreen("topics") | Task 1 |
| Catalog screen: same grouped list with section headers | Task 1 |
| Catalog screen: Обновить каталог / Обновить колоды buttons | Task 1 |

**Placeholder scan:** None found.

**Type consistency:** All prop names consistent across tasks — `record`, `onInfo`, `onClose`, `onAnalytics`, `onDelete`. `installCatalogEntry` signature `(entry, { force })` same in both Tasks 1 and 4. `setActiveTopicId(id)` (string, not object) — confirmed from store.js line 103.

**One gap fixed:** `getBuiltinTopicAvatarPath` is imported in `TopicCatalogScreen` (for `CatalogTopicItem`) but not used in the new `TopicLibraryScreen.jsx` (which no longer has a `CatalogTopicItem`). Import removed from Task 4. ✓
