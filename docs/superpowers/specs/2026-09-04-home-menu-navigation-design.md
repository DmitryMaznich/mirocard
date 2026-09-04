# Home menu navigation redesign — design spec

## Problem

The home screen header currently has a person-circle icon that opens
`SettingsScreen`, a single screen mashing together the parent/teacher's own
profile, password change, student switching, advance-timing/PIN, the
physical-keyboard toggle, shopping-zone customization, and account deletion.

Reaching a student's own data (e.g. adding a reward-video link) takes three
hops: Settings → "Сменить ученика" button inside `AccountCard` → students
list → edit. Nothing about that path is discoverable — a new user has no
reason to guess that editing a student starts inside "Settings".

## Goals

- One tap from the home screen to the students list.
- Group navigation so destinations reflect what they actually are: things
  that belong to the account (the profile itself, and the students under
  it) vs. app-level behavior settings.
- Reserve an obvious, already-structured place for an upcoming interface
  language switcher, without building it now.

## Non-goals

- Building interface localization/i18n now — confirmed a separate, later
  project (extracting every hardcoded Russian string, a translation
  catalog, a language-state mechanism). This design only reserves its
  future menu slot.
- Changing `StudentsScreen`/`StudentEditScreen` internals — they already do
  the right thing (list, add, edit, reward videos, close adults, portal
  links). Only their entry point moves.
- Adding a URL/history-stack router. Not needed: `StudentsScreen` and
  `SettingsScreen` already hardcode `"home"` as their back target, so a new
  entry point from the home menu doesn't break anything.

## Design

### Header

`src/features/home/HomeScreen.jsx` — replace the `AccountIcon` (person
circle) rendered in `home-header__settings-btn` with a hamburger icon (3
horizontal lines, same stroke style as the existing icon: `stroke-width
1.75`, 22×22 viewBox). The button opens the new menu sheet instead of
navigating straight to `"settings"`. `aria-label` changes from "Настройки"
to "Меню".

### Menu (`HomeMenuSheet`)

New file `src/features/home/HomeMenuSheet.jsx`, modeled directly on
`src/features/topics/TopicActionSheet.jsx`'s pattern — same
`.action-sheet-overlay` / `.action-sheet` / `.action-sheet__item` classes,
no new CSS needed. Sectioned rather than a flat list, to make the
account→students relationship visible without adding a navigation hop:

```
Аккаунт
  Профиль     → setScreen("account")
  Ученики     → setScreen("students")
Приложение
  Настройки   → setScreen("settings")
Отмена
```

Section labels reuse the existing `.action-sheet__title` style (rendered
twice, once per group — nothing in that CSS class assumes it appears only
once). A one-line code comment above the "Приложение" section notes that
this is where a future "Язык" row belongs once interface i18n ships, so
the placement doesn't need to be re-derived later. No placeholder/disabled
row is rendered now — an inert menu item would confuse users before the
feature exists.

### New "Профиль" (Account) screen

New file `src/features/settings/AccountScreen.jsx`, registered as
`"account"` in `App.jsx`'s `SCREENS` map. Contents carved out of today's
`SettingsScreen.jsx`:

- `<AccountCard onLogout={...}/>` (trimmed, see below)
- "Безопасность" section (change-password link) — moved here from
  Settings, since it's an account credential, not app behavior
- `<DangerZone/>` (delete account) — moved here for the same reason

Back button → `setScreen("home")`, same convention as every other
top-level screen.

`AccountCard.jsx` changes: remove the `account-card__student-row` ("Ученик:
X") and `account-card__students-btn` ("Сменить ученика/Выбрать ученика")
— redundant now that Students is a first-class top-level destination, and
the active student's name/avatar is already visible in the home header
itself. `AccountCard` becomes purely about the parent/teacher's own
identity: name, role, email, member-since, edit, logout.

### Trimmed "Настройки" screen

`SettingsScreen.jsx` keeps only: "Темп продолжения" (adultConfirmAdvance /
tapToAdvance / autoAdvanceDelay + the PIN gate), "Управление" (physical
keyboard toggle), and `<ZoneSettingsSection/>`. Title stays "Настройки",
back → home (unchanged).

### Students flow

Unchanged. `StudentsScreen.jsx` / `StudentEditScreen.jsx` keep working
exactly as they do today (list, add, edit, delete, reward videos, close
adults, portal links, active-task pin). Only the entry point moves closer:
one tap from home via the menu, instead of three hops via Settings.

## Files touched

- `src/features/home/HomeScreen.jsx` — icon swap, menu-open state, render
  `<HomeMenuSheet/>`
- new `src/features/home/HomeMenuSheet.jsx`
- new `src/features/settings/AccountScreen.jsx`
- `src/features/settings/SettingsScreen.jsx` — remove the AccountCard /
  password / DangerZone sections
- `src/features/settings/AccountCard.jsx` — remove the student-switch
  row/button
- `src/App.jsx` — register the `"account"` screen
- `src/styles.css` — remove the now-dead AccountCard rules
  (`.account-card__student-row`, `.account-card__student-label`,
  `.account-card__student-value`/`--empty`, `.account-card__students-btn`).
  No new CSS: the menu reuses `.action-sheet*` verbatim.

## Testing

No existing automated test references `AccountCard`, `SettingsScreen`, or
"Сменить ученика" (confirmed by grep), so there's no test suite to update.
Verification is manual: a Playwright walk-through of home → hamburger →
each of the three destinations, confirming Students/StudentEdit (including
the reward-videos field) still work unchanged, and that Account/Settings
each render their trimmed section set with nothing orphaned or duplicated.

## Risks / open questions

None blocking. The only deliberately deferred item is the interface
language switcher itself — out of scope by agreement; this design only
reserves its future location under "Приложение".
