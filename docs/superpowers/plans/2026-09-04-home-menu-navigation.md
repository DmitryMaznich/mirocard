# Home Menu Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home screen's account icon with a hamburger menu (Профиль / Ученики / Настройки, grouped into "Аккаунт" and "Приложение" sections), so editing a student no longer requires going through Settings first.

**Architecture:** A new `HomeMenuSheet` bottom sheet (built on the app's existing `.action-sheet` CSS pattern, no new styling) opens from the home header and routes to three existing/new top-level screens via the app's flat `setScreen(name)` router. `AccountCard`/password-change/account-deletion move out of `SettingsScreen` into a new `AccountScreen`; `SettingsScreen` keeps only app-behavior sections.

**Tech Stack:** React (hand-rolled state router via Zustand `screen` string in `src/core/store.js`, no react-router), Vitest for component smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-04-home-menu-navigation-design.md`

## Global Constraints

- Reuse the existing `.action-sheet-overlay` / `.action-sheet` / `.action-sheet__item` CSS classes (`src/styles.css`, ~line 20988) for the new menu — no new sheet/drawer CSS pattern.
- Do not add a URL router or navigation history stack. Every screen's back button keeps hardcoding `setScreen("home")`, exactly as `StudentsScreen.jsx` and `SettingsScreen.jsx` already do.
- Do not modify `StudentsScreen.jsx` or `StudentEditScreen.jsx` — only what links to them changes.
- Do not build interface localization/i18n. The "Приложение" menu section is reserved for a future "Язык" row (documented with a code comment only) — no placeholder row is rendered.

---

### Task 1: `HomeMenuSheet` component

**Files:**
- Create: `src/features/home/HomeMenuSheet.jsx`
- Test: `src/features/home/HomeMenuSheet.smoke.test.jsx`
- Modify: `src/styles.css` (add one small class near the existing `.action-sheet__title` rule, ~line 21012)

**Interfaces:**
- Produces: `HomeMenuSheet({ onClose, onOpenProfile, onOpenStudents, onOpenSettings })` — a default-exported React component. All four props are functions with no arguments. Renders a bottom-sheet overlay; clicking the overlay background, "Отмена", or any of the three destination rows calls `onClose()`. Clicking a destination row also calls its matching `onOpen*()` callback (called before `onClose()`).

- [ ] **Step 1: Write the failing test**

Create `src/features/home/HomeMenuSheet.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import HomeMenuSheet from "./HomeMenuSheet.jsx";

// Mounts the real component -- HomeMenuSheet is pure props-in, no store/db
// dependency, so this doesn't need any of the mocking other feature smoke
// tests in this app require (same reasoning as TopicTile.smoke.test.jsx).

describe("HomeMenuSheet — mounted through the real component", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.clearAllMocks();
  });

  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<HomeMenuSheet {...props} />);
    });
  }

  function baseProps() {
    return {
      onClose: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenStudents: vi.fn(),
      onOpenSettings: vi.fn(),
    };
  }

  it("renders the three destinations grouped into two sections", () => {
    mount(baseProps());
    const items = Array.from(container.querySelectorAll(".action-sheet__item")).map((el) => el.textContent);
    expect(items).toEqual(["Профиль", "Ученики", "Настройки", "Отмена"]);
    const titles = Array.from(container.querySelectorAll(".action-sheet__title")).map((el) => el.textContent);
    expect(titles).toEqual(["Аккаунт", "Приложение"]);
  });

  it("tapping Ученики calls onOpenStudents and closes the sheet", () => {
    const props = baseProps();
    mount(props);
    const [, studentsBtn] = container.querySelectorAll(".action-sheet__item");
    act(() => { studentsBtn.click(); });
    expect(props.onOpenStudents).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });

  it("tapping the overlay background closes without navigating", () => {
    const props = baseProps();
    mount(props);
    act(() => { container.querySelector(".action-sheet-overlay").click(); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenStudents).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });

  it("Отмена closes without navigating", () => {
    const props = baseProps();
    mount(props);
    const cancelBtn = container.querySelector(".action-sheet__item--cancel");
    act(() => { cancelBtn.click(); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenStudents).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/HomeMenuSheet.smoke.test.jsx`
Expected: FAIL — `Failed to resolve import "./HomeMenuSheet.jsx"` (file doesn't exist yet).

- [ ] **Step 3: Add the CSS divider class**

In `src/styles.css`, find the `.action-sheet__title { ... }` rule (currently lines 21007-21012 — re-check with `grep -n "action-sheet__title {" src/styles.css`, since Task 1's own edits above don't touch this file above this point, but confirm anyway) and add this new modifier rule immediately after it:

```css
/* Second title row in a sectioned sheet (e.g. HomeMenuSheet's "Приложение"
   group) -- same look as .action-sheet__title, plus a divider so the two
   groups don't visually run together. */
.action-sheet__title--divided {
  border-top: 1px solid #f0f5f4;
  margin-top: 4px;
}
```

- [ ] **Step 4: Write the component**

Create `src/features/home/HomeMenuSheet.jsx`:

```jsx
export default function HomeMenuSheet({ onClose, onOpenProfile, onOpenStudents, onOpenSettings }) {
  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="action-sheet-overlay" onClick={handleOverlay}>
      <div className="action-sheet" role="dialog" aria-modal="true">
        <div className="action-sheet__title">Аккаунт</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenProfile(); onClose(); }}
        >
          Профиль
        </button>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenStudents(); onClose(); }}
        >
          Ученики
        </button>

        {/* This section is also the reserved home for a future "Язык"
            (interface language) row once i18n ships -- keep it a separate
            group from "Аккаунт" rather than merging Настройки in above. */}
        <div className="action-sheet__title action-sheet__title--divided">Приложение</div>
        <button
          className="action-sheet__item"
          onClick={() => { onOpenSettings(); onClose(); }}
        >
          Настройки
        </button>

        <button className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/home/HomeMenuSheet.smoke.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/home/HomeMenuSheet.jsx src/features/home/HomeMenuSheet.smoke.test.jsx src/styles.css
git commit -m "feat(home): add HomeMenuSheet component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the hamburger icon + sheet into `HomeScreen`

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:30-38` (icon), `:53-87` (`HomeHeader`), `:701-702` (state), `:829-841` (render `HomeHeader`), `:872-873` (render `HomeMenuSheet`)

**Interfaces:**
- Consumes: `HomeMenuSheet({ onClose, onOpenProfile, onOpenStudents, onOpenSettings })` from Task 1.
- Consumes: `setScreen(name)` from `useAppStore` (already used throughout this file; the new screen name is `"account"`, added in Task 3).

- [ ] **Step 1: Import `HomeMenuSheet`**

In `src/features/home/HomeScreen.jsx`, add near the other feature imports (after line 25, before the `InstructionsTab`/`LessonPlanTab` imports or after them — grouping doesn't matter, just add it once):

```jsx
import HomeMenuSheet from "./HomeMenuSheet";
```

- [ ] **Step 2: Replace `AccountIcon` with `MenuIcon`**

Replace lines 30-38 (the whole `AccountIcon` function):

```jsx
function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 19C3.5 15.13 6.91 12 11 12C15.09 12 18.5 15.13 18.5 19"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
```

with:

```jsx
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M3.5 6.5H18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M3.5 11H18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M3.5 15.5H18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Update `HomeHeader`'s button**

In the same file, in the `HomeHeader` function (currently lines 53-87), rename the `onSettings` prop to `onMenu` and swap the icon/label. Replace:

```jsx
function HomeHeader({
  student, buildInfo, hasUpdate, refreshingAll, refreshFailed, versionTitle,
  onRefresh, onSettings, onAvatarTap,
}) {
```

with:

```jsx
function HomeHeader({
  student, buildInfo, hasUpdate, refreshingAll, refreshFailed, versionTitle,
  onRefresh, onMenu, onAvatarTap,
}) {
```

and replace the settings button at the end of the same function:

```jsx
      <button className="home-header__settings-btn" onClick={onSettings} aria-label="Настройки">
        <AccountIcon />
      </button>
```

with:

```jsx
      <button className="home-header__settings-btn" onClick={onMenu} aria-label="Меню">
        <MenuIcon />
      </button>
```

- [ ] **Step 4: Add sheet-open state**

Near the other `useState` calls in the main `HomeScreen` component (currently lines 701-702, right by `refreshingAll`/`refreshFailed`), add:

```jsx
  const [menuOpen, setMenuOpen] = useState(false);
```

- [ ] **Step 5: Wire the header prop and render the sheet**

Replace the `HomeHeader` call (currently lines 831-841):

```jsx
      <HomeHeader
        student={student}
        buildInfo={buildInfo}
        hasUpdate={hasUpdate}
        refreshingAll={refreshingAll}
        refreshFailed={refreshFailed}
        versionTitle={versionTitle}
        onRefresh={refreshAppAndTopics}
        onSettings={() => setScreen("settings")}
        onAvatarTap={handleAvatarSecretTap}
      />
```

with:

```jsx
      <HomeHeader
        student={student}
        buildInfo={buildInfo}
        hasUpdate={hasUpdate}
        refreshingAll={refreshingAll}
        refreshFailed={refreshFailed}
        versionTitle={versionTitle}
        onRefresh={refreshAppAndTopics}
        onMenu={() => setMenuOpen(true)}
        onAvatarTap={handleAvatarSecretTap}
      />
```

Then, right before the final closing `</div>` of the component (currently line 873, immediately after the `<HomeTabs .../>` line), add:

```jsx
      {menuOpen && (
        <HomeMenuSheet
          onClose={() => setMenuOpen(false)}
          onOpenProfile={() => setScreen("account")}
          onOpenStudents={() => setScreen("students")}
          onOpenSettings={() => setScreen("settings")}
        />
      )}
```

- [ ] **Step 6: Verify no leftover references to the old prop/icon names**

Run: `grep -rn "AccountIcon\|onSettings=" src/features/home/HomeScreen.jsx`
Expected: no output (both names are fully replaced). If `AccountIcon` or `onSettings=` still appear, find and fix the remaining spot before moving on.

- [ ] **Step 7: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(home): open a menu sheet from the hamburger icon

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(This task intentionally does not build/run the app yet — `setScreen("account")` targets a screen that doesn't exist until Task 3. Manual verification happens in Task 6.)

---

### Task 3: New `AccountScreen`, registered as `"account"`

**Files:**
- Create: `src/features/settings/AccountScreen.jsx`
- Modify: `src/App.jsx:33` (import), `src/App.jsx:85` (SCREENS map)

**Interfaces:**
- Consumes: `AccountCard` (existing, trimmed in Task 5 — its public props don't change: `onLogout`), `ChangePasswordModal`, `DangerZone` (existing, unchanged), `BackArrowIcon` (existing), `useAppStore` (`setScreen`, `logout`), `getDb` (`@/core/db`), `api` (`@/core/api`), `clearUserIdbData` (`@/core/bootstrap`).
- Produces: default-exported `AccountScreen()` component, registered under the `"account"` key so `setScreen("account")` (used in Task 2) resolves to it.

- [ ] **Step 1: Create the screen**

Create `src/features/settings/AccountScreen.jsx`:

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
import { clearUserIdbData } from "@/core/bootstrap";
import AccountCard from "./AccountCard";
import ChangePasswordModal from "./ChangePasswordModal";
import DangerZone from "./DangerZone";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function AccountScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const logout    = useAppStore((s) => s.logout);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {
      // Local logout should still proceed when the network request fails.
    }
    const db = await getDb();
    await clearUserIdbData(db);
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Аккаунт</h1>
      </div>

      <div className="settings-body">
        <AccountCard onLogout={handleLogout} />

        <div className="settings-section">
          <div className="settings-section-title">Безопасность</div>
          <div className="settings-row">
            <span className="settings-row__label">Пароль</span>
            <button className="link-btn" onClick={() => setChangePasswordOpen(true)}>
              Сменить пароль
            </button>
          </div>
        </div>
      </div>

      <DangerZone />

      {changePasswordOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the screen in `App.jsx`**

In `src/App.jsx`, add the import after line 33 (`import SettingsScreen from "@/features/settings/SettingsScreen";`):

```jsx
import AccountScreen from "@/features/settings/AccountScreen";
```

Then in the `SCREENS` map, add a line right after `settings: SettingsScreen,` (currently line 85):

```jsx
  account: AccountScreen,
```

- [ ] **Step 3: Sanity-check the build**

Run: `npm run build`
Expected: build succeeds (no import errors). This won't yet prove the screen renders correctly at runtime — that's Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/AccountScreen.jsx src/App.jsx
git commit -m "feat(settings): add a dedicated Account screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Trim `SettingsScreen` down to app-behavior sections

**Files:**
- Modify: `src/features/settings/SettingsScreen.jsx` (full-file rewrite — see below)

**Interfaces:**
- No external interface changes: `SettingsScreen` stays a default-exported, prop-less component registered under `"settings"`. Its back button still calls `setScreen("home")`.

This task removes `AccountCard`, the "Безопасность" (password) section, `DangerZone`, and the logout flow (all moved to `AccountScreen` in Task 3). It also fixes a pre-existing bug found while reading this file: `handlePatchSettings` calls `kv.set(...)` without `kv` ever being imported, so today every toggle in this screen (advance-timing, PIN, physical keyboard) silently fails to persist to IndexedDB after an app restart (the in-memory Zustand update still happens, so the checkbox *looks* like it worked). Fix: import `kv` alongside `getDb`, matching how `AccountCard.jsx` already imports both from the same module.

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `src/features/settings/SettingsScreen.jsx` with:

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import ZoneSettingsSection from "./ZoneSettingsSection";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function SettingsScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const settings         = useAppStore((s) => s.settings);
  const patchSettings    = useAppStore((s) => s.patchSettings);

  const adultPinHash      = settings.adultPinHash ?? null;
  const physicalKeyboard  = settings.physicalKeyboard ?? false;
  const [pinResetMode, setPinResetMode] = useState(null); // null | "verify-old" | "set-new"

  const adultConfirmAdvance = settings.adultConfirmAdvance ?? true;
  const tapToAdvance     = settings.tapToAdvance ?? true;
  const requiresTapToAdvance = adultConfirmAdvance || tapToAdvance;
  const autoAdvanceDelay = settings.autoAdvanceDelay ?? 3;

  async function handlePatchSettings(patch) {
    patchSettings(patch);
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, ...patch });
  }

  function startPinReset() {
    setPinResetMode(adultPinHash === null ? "set-new" : "verify-old");
  }

  function handleVerifyOldSuccess() {
    setPinResetMode("set-new");
  }

  async function handleSetNewPin(hash) {
    await handlePatchSettings({ adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  function handleSetNewSuccess() {
    setPinResetMode(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Настройки</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Темп продолжения</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ adultConfirmAdvance: !adultConfirmAdvance })}
          >
            <span className="settings-row__label">Переход после подтверждения</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ cursor: adultConfirmAdvance ? "default" : "pointer", opacity: adultConfirmAdvance ? 0.55 : 1 }}
            onClick={() => {
              if (!adultConfirmAdvance) handlePatchSettings({ tapToAdvance: !tapToAdvance });
            }}
          >
            <span className="settings-row__label">Следующая карта по тапу</span>
            <input
              type="checkbox"
              checked={adultConfirmAdvance ? true : tapToAdvance}
              readOnly
              disabled={adultConfirmAdvance}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
          <div
            className="settings-row"
            style={{ opacity: requiresTapToAdvance ? 0.4 : 1, pointerEvents: requiresTapToAdvance ? "none" : "auto" }}
          >
            <div className="settings-row__label">Задержка (сек)</div>
            <div className="param-stepper">
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay <= 1}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay - 1 })}
              >−</button>
              <span className="stepper-value">{autoAdvanceDelay}</span>
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay >= 10}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay + 1 })}
              >+</button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">PIN-код занятия</span>
            <button className="link-btn" onClick={startPinReset}>
              {adultPinHash ? "Изменить PIN" : "Задать PIN"}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Управление</div>
          <div
            className="settings-row"
            style={{ cursor: "pointer" }}
            onClick={() => handlePatchSettings({ physicalKeyboard: !physicalKeyboard })}
          >
            <span className="settings-row__label">Физическая клавиатура</span>
            <input
              type="checkbox"
              checked={physicalKeyboard}
              readOnly
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0, cursor: "pointer" }}
            />
          </div>
        </div>

        <ZoneSettingsSection />

      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>

      {pinResetMode === "verify-old" && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={handleVerifyOldSuccess}
          onSetPin={() => {}}
          onCancel={() => setPinResetMode(null)}
        />
      )}
      {pinResetMode === "set-new" && (
        <PinGateModal
          pinHash={null}
          onSuccess={handleSetNewSuccess}
          onSetPin={handleSetNewPin}
          onCancel={() => setPinResetMode(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sanity-check the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/SettingsScreen.jsx
git commit -m "refactor(settings): trim Settings to app-behavior sections only

Account profile, password change, and account deletion moved to the new
AccountScreen (previous commit). Also fixes handlePatchSettings silently
failing to persist to IndexedDB — it called kv.set(...) without ever
importing kv, so every toggle on this screen looked like it worked but
reverted on the next app restart.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Trim `AccountCard` (remove the student-switch row/button)

**Files:**
- Modify: `src/features/settings/AccountCard.jsx`
- Modify: `src/styles.css:16543-16565`, `:16590-16606` (delete)

**Interfaces:**
- No external interface change: `AccountCard({ onLogout })` keeps the same single prop.

- [ ] **Step 1: Remove the student-row and students-btn from the JSX**

In `src/features/settings/AccountCard.jsx`, replace:

```jsx
          <div className="account-card__student-row">
            <span className="account-card__student-label">Ученик:</span>
            <span className={`account-card__student-value${activeStudent ? '' : ' account-card__student-value--empty'}`}>
              {activeStudent ? activeStudent.name : 'не выбран'}
            </span>
          </div>

          <div className="account-card__actions">
            <button className="account-card__edit-btn" onClick={startEdit} aria-label="Редактировать профиль">
              ✎ Изменить
            </button>
            <button className="account-card__students-btn" onClick={() => setScreen("students")}>
              {activeStudent ? "Сменить ученика" : "Выбрать ученика"} <ChevronRightIcon size={14} />
            </button>
          </div>
```

with:

```jsx
          <div className="account-card__actions">
            <button className="account-card__edit-btn" onClick={startEdit} aria-label="Редактировать профиль">
              ✎ Изменить
            </button>
          </div>
```

- [ ] **Step 2: Remove the now-unused imports and store reads**

Remove the `ChevronRightIcon` import:

```jsx
import { ChevronRightIcon } from "@/shared/components/ArrowIcons";
```

Remove the now-unused store reads (previously used only for the student-row/button):

```jsx
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeStudent = students.find((s) => s.id === activeStudentId);
```

(`useAppStore` itself is still used for `account`/`setAccount`, so keep that import line — only remove the four lines above.)

- [ ] **Step 3: Remove the now-dead CSS**

In `src/styles.css`, delete these two blocks (verify exact line numbers with `grep -n "account-card__student\|account-card__students-btn" src/styles.css` first, since Tasks 1-4 may have shifted line numbers elsewhere in the file — this block itself is untouched by earlier tasks):

```css
.account-card__student-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(28, 54, 52, 0.08);
}
.account-card__student-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #9aa6a3;
}
.account-card__student-value {
  font-size: 0.92rem;
  font-weight: 800;
  color: #263131;
}
.account-card__student-value--empty {
  font-weight: 600;
  font-style: italic;
  color: #9aa6a3;
}
```

and:

```css
.account-card__students-btn {
  align-self: flex-start;
  padding: 7px 14px;
  border-radius: 10px;
  border: 1.5px solid rgba(74, 155, 143, 0.35);
  background: rgba(74, 155, 143, 0.1);
  color: #2a6b60;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.account-card__students-btn:hover {
  background: rgba(74, 155, 143, 0.2);
  border-color: #4a9b8f;
}
```

- [ ] **Step 4: Confirm nothing else references the removed classes**

Run: `grep -rn "account-card__student\b\|account-card__students-btn" src/`
Expected: no output.

- [ ] **Step 5: Sanity-check the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/AccountCard.jsx src/styles.css
git commit -m "refactor(settings): drop the student-switch row from AccountCard

Students is now a first-class destination from the home menu, so the
'Сменить ученика' shortcut buried inside Account is redundant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Manual verification pass

**Files:** none (verification only; fix forward in the relevant file from Tasks 1-5 if something's broken, then re-run this task's steps).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run src/features/home src/features/settings`
Expected: all tests pass, including the 4 new `HomeMenuSheet` tests from Task 1.

- [ ] **Step 2: Start the dev server**

Run in background: `npm run dev`
Note the printed local URL (port may not be 8080 if already in use — check the command's output).

- [ ] **Step 3: Walk through the new flow in a browser**

Using Playwright (headed) or a manual browser, against the dev server URL:
1. Log in / enter local mode, land on the home screen.
2. Confirm the header's right-side icon is now a hamburger (3 lines), not a person circle.
3. Tap it — confirm the sheet opens with sections "Аккаунт" (Профиль, Ученики) and "Приложение" (Настройки), plus "Отмена".
4. Tap outside the sheet (the dimmed background) — confirm it closes without navigating.
5. Reopen the menu, tap "Ученики" — confirm it goes straight to the students list (no detour through any account/settings screen). Open a student's edit form and confirm the reward-video field is still there and editable (this field's presence is the whole point of the original complaint).
6. Back out to home, reopen the menu, tap "Профиль" — confirm the new Account screen shows: profile card (name/email/edit/logout), "Безопасность" → "Сменить пароль", and the "Удаление аккаунта" danger zone at the bottom. Confirm there is **no** "Ученик: ..." row or "Сменить ученика" button anywhere on this screen.
7. Back to home, reopen the menu, tap "Настройки" — confirm it shows only "Темп продолжения", "Управление" (physical keyboard), and the shopping-zone section, with no account/profile content.
8. In Настройки, toggle "Физическая клавиатура" off and back on, then reload the page — confirm the toggle's state survived the reload (this is the regression check for the `kv` import fix in Task 4; before that fix, the toggle would silently revert after a reload).
9. Check the browser console throughout — no new errors.

- [ ] **Step 4: Stop the dev server**

Stop the background `npm run dev` process.

- [ ] **Step 5: If everything passed, this plan is done. If something broke, fix it in the relevant Task's file, re-run that task's build/test check, then re-run Task 6 from Step 1.**

---

## Self-Review Notes

- **Spec coverage:** every section of the spec (`2026-09-04-home-menu-navigation-design.md`) maps to a task — header icon (Task 2), menu sheet (Task 1 + 2), new Account screen (Task 3), trimmed Settings (Task 4), trimmed AccountCard (Task 5), manual testing (Task 6). The spec's "reserve a slot for Язык" requirement is covered by the code comment in Task 1's component and the Global Constraints section above (no placeholder row rendered).
- **Type/name consistency checked:** `HomeMenuSheet`'s prop names (`onClose`, `onOpenProfile`, `onOpenStudents`, `onOpenSettings`) are identical between its Task 1 definition, its Task 1 test, and its Task 2 call site. The `"account"` screen key is identical between Task 2's `setScreen("account")` call and Task 3's `SCREENS` map entry.
- **Pre-existing bug fix flagged, not hidden:** the missing `kv` import in `SettingsScreen.jsx` is called out explicitly in Task 4 (both in the task body and the commit message) rather than silently folded in, since it's a real behavior change a reviewer needs to notice.
