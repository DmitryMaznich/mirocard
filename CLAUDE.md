# Mirocard2 - Claude Code Setup

## Canonical Project Root

Work from this directory only:

```text
C:\Users\dmazn\Projects\Mirocard2
```

Do not open backup archives, restored backup folders, Synology backup folders, `dist/`, `runtime/`, or `output/` as the main project.

## Runtime Host (Railway)

> **ВАЖНО:** production теперь на Railway (проект "Mirocard", сервис `mirocard-backend`), не на локальной машине. Деплой — `git push origin main` (Railway auto-deploy из GitHub). БД — SQLite на Railway Volume (`/data`), недоступна напрямую через SSH; для чтения/изменения продакшн-БД нужен Railway API/dashboard shell, не paramiko. Локальный файл `runtime/data/mirocard.db` в рабочей копии — это **не продакшн**, а локальная разработка.

| Parameter | Value |
|-----------|-------|
| Public URL | `https://app.mironium.com/` |
| Railway project | Mirocard |
| Railway service | `mirocard-backend` |
| Source | GitHub `DmitryMaznich/mirocard`, branch `main` |
| Backend + SPA | serves both (`SERVE_STATIC=1`), no separate reverse proxy |
| DB | SQLite on Railway Volume, `MIROCARD_DATA_DIR=/data` |
| Backups | hourly, in-process (`scripts/railway-backup-loop.mjs`), only runs when `RAILWAY_ENVIRONMENT` is set |

Do not deploy the backend to Synology. Synology/SmartNAS is backup storage only.

Email-подтверждение и восстановление пароля шлются через Resend API (`RESEND_API_KEY`, `backend/lib/mailer.mjs`), не через SMTP — старое ограничение с недоступным `mail.kaplieva.help` больше не актуально. См. `DEPLOYMENT.md`.

### Старый хост (retired 2026-08-23)

Домашний Windows/Caddy хост (`192.168.1.163`, публичный адрес `mirocard.kaplieva.help`) отключён: `MirocardBackend2` scheduled task — **Disabled** (не удалён, обратимо). `/api/*` там теперь 502. Подробности старой схемы — в `DEPLOYMENT.md`, раздел "Former production path".

## Landing page (mironium.com)

Отдельный от приложения статический сайт-визитка в `landing/` (только `index.html`, `og.png`, `server.mjs`, `Dockerfile` — `landing/v2/` не используется, это заброшенный черновик, в образ не попадает). Деплоится как **отдельный Railway-сервис** `mironium-landing` в том же проекте Mirocard, из того же GitHub-репо (`DmitryMaznich/mirocard`, branch `main`), но с root directory `landing` — поэтому пуш в `main` пересобирает и лендинг, и `mirocard-backend` одновременно (это ожидаемо и безопасно: код бэкенда не меняется, просто инвалидируется docker-кэш).

| Parameter | Value |
|-----------|-------|
| Public URL | `https://mironium.com/` и `https://www.mironium.com/` |
| Railway project | Mirocard |
| Railway service | `mironium-landing` |
| Source | GitHub `DmitryMaznich/mirocard`, branch `main`, root directory `landing` |
| Server | `landing/server.mjs` — нулевые зависимости, обслуживает статику через `node:http`, слушает `$PORT` |

Правки контента лендинга — обычный `git push origin main`, без версии `package.json` (лендинг не входит в "app code" из правила версионирования — как деки-зипы и доки, см. секцию `Deploy`). Deploy-doc для приложения (`app.mironium.com`) этого не касается — это два независимых Railway-сервиса на одном проекте и одном репо.

## Credentials

Do not write secrets into repository docs. Use environment variables, Windows Credential Manager, SSH keys, or the password manager.

Local files that may contain secrets and must stay gitignored:

```text
.env
backend/.env
```

If credentials are needed for deployment, use `MIROCARD_DEPLOY_PASSWORD` or `MIROCARD_DEPLOY_KEY_PATH` outside git.

## Deploy

```bash
git push origin main   # Railway auto-deploys the whole app (frontend + backend)
```

`npm run deploy:prod` / `npm run deploy:verify` target the **old, retired** Windows/Caddy host — do not run them expecting a production effect; they no longer touch what's actually live.

Before pushing to `main`: run `git status --short`, commit intentional changes, run `npm run build` locally as a sanity check.

**Mandatory: every push to `main` that changes app behavior must bump the version in `package.json` first, in its own commit.** `git push origin main` deploys to production immediately (Railway auto-deploy) with no review gate, so the version is the only signal that distinguishes one deploy from the next — skipping it means `/api/version` can't tell you whether a given fix actually shipped. Bump before pushing, not after:

```bash
npm version patch --no-git-tag-version
git add package.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git push origin main
```

Skip only for changes that touch no app code (docs, this file, deck ZIPs pushed separately, etc).

After pushing, verify `https://app.mironium.com/api/version` returns the new version and `/` responds before considering the deploy done.

Details: `DEPLOYMENT.md`.

### Deck-zip topics load from their downloaded ZIP, not the app bundle

Most topics under `src/topics/renderers/<id>/` that also have a `tools/<id>/build.mjs` are **not** served from the main app bundle in production — `SessionScreen` calls `loadRenderer(topicId)` first, which fetches/caches `public/decks/<id>_v<version>.zip` (built by that `build.mjs`) and only falls back to the bundled `RENDERER_REGISTRY` version if that fails. So editing `src/topics/renderers/<id>/*.jsx`/`.css`/`.js` and pushing to `main` ships the *source*, but the running app keeps rendering whatever's in the last-published ZIP until that ZIP is rebuilt too — the one hard-coded exception is `spatial_prepositions` (`shouldPreferBundledRenderer` in `SessionScreen.jsx` forces it to always use the bundled renderer, ignoring any downloaded ZIP).

Learned the hard way twice on the `comparison` topic (2026-08-27): a source-only push left production showing the old UI even after `/api/version` had already bumped.

**If your change touches a deck-zip topic's renderer, do this in the same push as the source change:**

```bash
# 1. bump that topic's own version (tools/<id>/topic.json → meta.version)
# 2. rebuild:
node tools/<id>/build.mjs
# 3. publish under the new version and point the catalog at it:
cp tools/<id>/comparison.zip public/decks/<id>_v<new-version>.zip   # filename per topic
# then edit public/decks/catalog.json: bump that topic's "version" and "url"
git add tools/<id>/topic.json tools/<id>/*.zip public/decks/catalog.json public/decks/<id>_v<new-version>.zip
```

Commit this alongside (or right before) the `package.json` version-bump commit above, then push.

**Delete the previous version's ZIP in the same commit** (`git rm public/decks/<id>_v<old-version>.zip`). Only the catalog's current version (and, for hidden topics, the latest one listed in `backend/generated/topic-inventory.json`) is ever served — the server 404s any other filename under `decks/` — and every old ZIP lands in the Docker image. 214 stale versions (756 MB) had piled up by 2026-10-12 and made each deploy push ~1.9 GB; they're still in git history if one is ever needed. A test that imports a specific old ZIP must read it from `test-fixtures/decks/` (outside the image) — `git grep` the old filename before deleting it.

Sanity-check the rebuilt ZIP actually contains your change before pushing: `unzip -p public/decks/<id>_v<new-version>.zip mirocard2.css | grep <a class or string you just added>`.

**The ZIP only contains the renderer's own entry graph — not `engine.js` if nothing else in the renderer imports it.** `tools/<id>/build.mjs` bundles exactly `src/topics/renderers/<id>/index.jsx` and whatever it transitively imports (the `*.jsx`/`.css` UI). Task *generation* (`engine.js`'s `generateTasks`) is registered separately in `src/topics/renderers/engineRegistry.js` and runs from the **main app bundle** via `ENGINE_REGISTRY`, regardless of which renderer ZIP is installed — `index.jsx` typically doesn't import its own topic's `engine.js` at all (the task object arrives as a prop, already built). So a change confined to `engine.js` (or a data module only `engine.js` imports, e.g. `comparison`'s `realLifeScenes.js`) needs **only** the normal `package.json` version bump + push — no deck-zip rebuild, and rebuilding one anyway just re-packages identical renderer code under a new, misleading version number. Only rebuild the zip when the change actually touches a file the renderer's `index.jsx` imports (its own `*.jsx`/`.css`). Confirmed 2026-08-28: `unzip`-inspecting `tools/comparison/dist/renderer` after adding scenes to `realLifeScenes.js` showed zero trace of the new data — expected, not a bug, because `CompareRealLife.jsx` never imports `engine.js`.

### Docker image (Railway)

`Dockerfile` is two-stage: the build stage installs everything and runs `npm run build`; the final image gets only `dist/`, `backend/` (with its own `node_modules`), `scripts/`, `src/` and `package.json` — exactly what `node backend/server.mjs` reads at runtime. If the backend starts importing or reading a file outside those paths, add it to the final stage or the server won't start on Railway. `.dockerignore` keeps `.git`, `docs/`, `landing/`, `test-fixtures/` etc. out of the build context; the git SHA comes from Railway's `RAILWAY_GIT_COMMIT_SHA` (`scripts/git-sha.mjs` falls back to it). A normal deploy pushes ~130 MB (mostly `dist/`), the whole image is ~580 MB including the Node base.

## Backend (Node.js)

The backend runs as part of the same Railway service as the frontend — no separate deploy step, no SFTP, no scheduled task to restart. A push to `main` redeploys both together.

## Backups

Backup destination:

```text
\\SmartNAS\home\Drive\!Документы\MirocardBackups
```

Backup scripts:

```text
scripts/backup-project.ps1
scripts/backup-db-hourly.ps1
scripts/backup-sqlite.mjs
scripts/install-backup-tasks.ps1
```

Rules for Claude Code:

- Do not inspect or edit Synology backup archives during normal development.
- Do not commit backup archives, restored backup folders, `.env`, `backend/.env`, or runtime database files.
- Do not run backup scripts with `-IncludeSecrets` unless the user explicitly asks and confirms the destination is encrypted/access-controlled.
- `runtime/data/mirocard.db` is production/runtime data, not source code.

Production DB protection (Railway, current):

- The `mirocard-backend` service itself runs the hourly backup loop in-process (`scripts/railway-backup-loop.mjs`), writing to `/data/backups/` on the same Volume. Only the newest 3 copies are kept (`BACKUP_KEEP`), and old ones are pruned at startup before the DB opens: the volume is 5 GB (the Hobby maximum), every copy is a full copy of the DB (photos/audio live in it), and 14 days of hourly copies filled it on 2026-10-19 -- every write and startup migration then failed with "database or disk is full".
- No off-site copy yet — known gap, not yet solved. `scripts/fetch-production-db-backup.py` (SSH-based, below) no longer applies to current production.
- Do not restart or stop the backend for backups.

Old host backups (retired, 192.168.1.163):

- Runtime host `192.168.1.163` ran `Mirocard Production DB Hourly Backup` hourly, writing to `C:\Users\dmazn\MirocardBackups\hourly-db`.
- `scripts/fetch-production-db-backup.py` fetched the latest backup over SSH for local full backup packages — this pulled from the old host's `runtime/data/mirocard.db`, not Railway.

Restore and scheduling details: `docs/backup-restore.md`.

## Прописи (propis2) — основная тема письма

Since 2026-10-14 the topic users see as **«Прописи»** is the one with id **`propis2`**
(page/notebook builder + modes «Узнай букву», «Строчная и заглавная», «Диктант»;
`src/features/propis2/`, `src/topics/renderers/propis2/`, `tools/propis2/`). Ids, file
names and sync keys (`propis2:*`) keep the `2` — only the displayed title changed.
Read `docs/propis2.md` before touching it.

The old topic (id **`propis`**) is now titled **«Прописи старые»** and is archived — catalog
status `"archived"` (`public/decks/catalog.json` + `backend/generated/topic-inventory.json`): the
server sends `archivedTopicIds`, the app keeps archived topics off the home screen of every
device, only the admin topic archive shows them. Archive only, no new work. In code
comments, name the topics by id (`propis2` / `propis`), not «Прописи 2» / v1. **But its code and data are NOT dead:** `propis2` imports the shared
engine from `src/topics/renderers/propis/` (`wordEngine.js`, `PrintPageView.jsx`,
`useLoopingStrokes.js`, `AnimatedStrokes.jsx`, `letters/*` views) and glyph data from
`tools/propis/` (`wide.json`, `elements.json`, `captures/`). Never delete those when
cleaning up the old topic; letter-shape edits still go into `tools/propis/`.
`docs/propis.md` is the old topic's history + the shared engine's pitfalls (ruling
geometry, glyph capture) — still worth reading when touching the shared engine.

Independent from `letter_writing` ("Написание букв") — don't touch that topic.

**Variants (other alphabets) — `propis2_bg` (Bulgarian), started 2026-10-18.** A variant is its own
ZIP topic with the same `propis2` renderer, built from data only
(`tools/propis2/variants/<id>/variant.json`, `node scripts/build-propis2-deck.mjs --variant <id>`),
shown to one account via catalog status `individual`. Never fork `propis2` code for a language: the
alphabet comes from `meta.alphabet` (`src/topics/renderers/propis2/alphabet.js`), never from a
hard-coded letter string. Read `docs/propis2-variants.md` before continuing.

**Языки письма в «Прописях» (с 2026-11-01, колода `propis2` 0.6.0).** Русский, болгарский и казахский в самой теме `propis2` (`tools/propis2/languages.json`); язык — у тетради (не у ученика), у карточек — параметр режима; диктант только русский. Тестовая копия `propis2_lang` в архиве. Read `docs/propis2-languages.md` before continuing.

**Казахские прописи (`propis2_kk`), планируется (2026-10-29).** Тот же приём, что у болгарских: вариант-колода на тех же движке и рендерере, 9 особых букв (Ә Ғ Қ Ң Ө Ұ Ү Һ І). Всё, что
узнали в сессии русских прописей (движок, соединения, пробел, стенд для картинок, правила работы с владельцем), собрано в **`docs/propis2-kk-handoff.md`: читать первым.**

## Важные даты (important dates) for the "Сегодня" screen

Birthdays, holidays and one-off events kept on the student
(`student.importantDates`, own sync op, merged per card like My People) and
shown by the `daily_orientation` topic: festive look on the day, a countdown
before it, "Вчера был …" with photos from the day, and question prompts for the
adult. Read `docs/important-dates.md` before continuing. The rest of the same
speech-therapy review of the topic (weather wording, letter case, spoken time,
plan pictures, what's deferred) is in `docs/daily-orientation-review.md`.

## Плюс и минус (addition_subtraction) design review — in progress

A mode-by-mode design/mechanics review of this topic's teaching ladder is under way
(started 2026-09-22/23), plus a backlog blocked on `GEMINI_API_KEY` (not available in
every session/sandbox — see below). **Read `docs/addition-subtraction-design-review.md`
first** if you're continuing this — it has exactly which modes are done, what's still
unreviewed, the two backlog items waiting on that API key (hand illustrations for mode 2,
recorded voice audio to replace browser TTS), and pitfalls already hit once this pass
(don't repeat them — e.g. the raw `chrome --headless --window-size` CLI flag is silently
ignored in some sandboxes, use Playwright instead when a screenshot's exact width matters).

## Глаголы (verbs_v2) — methodology rework planned

Speech-therapy audit of the topic for minimally verbal children with ASD (2026-10-17):
per-card verdicts for all 125 images, new vocabulary waves, a 12-step mode ladder and
a step-by-step implementation plan. **Read `docs/verbs-methodology-review.md` first**
before touching `verbs_v2`. Which verbs to add next (waves 4–5, Russian CDI norms) — `docs/verbs-research.md`. Wave 4 (сидит, даёт, открывает, моет руки, кидает, лежит, одевается, стоит, падает) is built into deck v2.2.0 with `card.alsoShows` (a picture is never a distractor for a posture it also shows) — status and pitfalls in `docs/verbs-wave4-shotlist.md`, section 6. Wave 5 (15 verbs: закрывает … пишет, летит) is built into deck v2.3.0 — status in `docs/verbs-wave5-shotlist.md`. Source lives in `tools/verbs_v2/` (`node tools/verbs_v2/build.mjs`
packs only files `deck.json` references). Deck v2.0.0 built (contrast set + variations via `card.set`); before that: steps 0–2, voice, image review with the
owner done (deck v1.5.1; audio via `tools/verbs_v2/generate-audio-elevenlabs.mjs`); next is step 3's
pictures — follow sections 5б–5г of the doc (no anthropomorphic animals, real photos, vary objects). The deck needs `meta.customModesOnly` + `verbs_`-prefixed mode
ids — without them `topicLoader` silently replaces generic flashcards modes' ui/params.

## Мои люди (my_people) — согласованная механика и переделка

**Сводка и порядок занятий — `docs/my-people-status.md`: читать первым** (два входа, лестница, что сделано 2026-11-06, план шлифовки).

Рабочая v2 реализована как включаемый взрослым пилот: сначала прочитать
`docs/my-people-implementation.md`. Без явного выбора остаётся старый маршрут;
«Занятия по плану» (бывшая «Новая механика») включают новый вход для ученика. Возврат — «Выключить занятия по плану» в подготовке.
Новый журнал `statistics.myPeople` не смешивать с legacy-оценками имени/роли.
SQLite schema не менялась; полный аварийный restore production вне volume ещё
не проверен — до глобального переключения по умолчанию выполнить план отката.

Последняя фиксация с владельцем — 2026-11-04, макеты 01–07. **Read
`docs/my-people-design.md` first** before continuing `my_people`. План реализации:
`docs/superpowers/plans/2026-11-04-my-people-redesign.md`. Основной путь:
`docs/mockups/my-people-2026-11-04/my-people-v07.html`; лестница 2/3/4/6:
`docs/mockups/my-people-2026-11-04/my-people-v06.html`.

**Rollback required by owner:** read `docs/my-people-rollback.md` before implementation.
Production baseline `1.0.2818`, SHA `9b7ca097983cd5cc2906563063deab45be7412c5`,
reserved branch `backup/my-people-before-redesign-2026-11-04` (do not move/delete).
Keep the old topic path behind a version switch; additive migrations must pass an
old-client/new-data round trip. Before release, verify a restorable production DB
and photo backup. The backup branch contains source code, not production data.

Зафиксировано: две цели (имя / отношение), выбор фото и называние, самостоятельная
работа и работа со взрослым, четыре компактные кнопки без поясняющего текста на
детском экране, параметры каждого задания и результат с условиями. Подготовленный
детский план меняется после подтверждения взрослого. Озвучка окончательно не
принята и отложена отдельно. HTML — макет, не готовый исходник React.

История: `docs/my-people-review.md` (2026-10-15) и
`docs/my-people-methodology-review.md` (2026-10-20), старый макет
`docs/mockups/my-people-redesign.html`. Старые предложения о едином результате
называния человека, большой взрослой панели и автоматическом критерии «освоено»
не заменяют последнюю спецификацию.

## Учим словенский — новая тема (started 2026-10-22)

Second language (Slovenian) for the owner's minimally verbal autistic son, starting from a
listening mode «Одна вещь — два слова» (Russian word = home, Slovenian word = school, Russian
faded out as a prompt). Not the app's Slovenian UI localization. **Read
`docs/learn-slovene.md` first** — methodology, vocabulary, chosen voices, plan and status.

## Короткие рассказы: микрорассказы (reading_short_stories)

Шлифовка 15 микрорассказов для ребёнка, который ещё не умеет и не хочет искать в тексте (начата
2026-11-04). Методика сделана в колоде 2.0.5: три вида вопросов (`?` поиск, `??` понимание,
`*` разговор), три уровня сборника; дизайн экранов ещё впереди. **Read
`docs/reading-micro-stories.md` first** — виды вопросов, правила их составления, сборка
(базовые колоды в `test-fixtures/decks/`, исходных PNG в git нет), открытые пункты.

## Разряды числа (place_value)

Topic split out of «Сложение и вычитание в столбик» on 2026-10-07; tens and
hundreds are done (menu 1–14 with two tests), thousands are next but on hold.
**Read the «Handoff» section of `docs/place-value.md` first** — menu, file map,
the owner's rules learned the hard way, the work procedure and open items;
per-mode decisions are in `docs/place-value-methodology.md` (sections 9–23).

## Латиница (latin_letters) — новая тема, проектирование (started 2026-11-07)

Separate topic (owner's decision — not a language/style inside `propis2` or `print_letters`) for
teaching children to write Latin script: English first, then other school styles as data (one engine,
style = glyphs + joins + ruling + slant). **Read `docs/latin-letters.md` first** — decisions, proposed
style families/order, open questions. Source catalogue (links only): `docs/research/handwriting/`.

## Печатные буквы (print_letters) — new topic, prototype (started 2026-11-01)

Printed-letter worksheet/notebook constructor for preschoolers (4–6yo), not cursive — a separate
topic from `propis2` (cursive) and from `letter_writing` (hidden/paid, **independent — don't touch**).
The method's primary source is V. A. Ilyukhina's workbooks «Волшебные линии» №1/№2 (`docs/references/ilyukhina/`,
analysis in `docs/print-letters-ilyukhina.md`) — letter shape, proportions, stroke order follow them.
**Read the «Handoff» section of `docs/print-letters.md` first** (current branch, what's built, the
owner's decisions, the screenshot harness, past process mistakes), then its «Разворот» sections for
why each earlier shape was replaced. Key facts: glyphs live in notebook-cell coordinates in
`tools/print_letters/topic.json` (1 cell = 50 units, letters 2 cells tall; width per Ilyukhina — half a
letter-cell = 1 cell, or two thirds (`wide`: Т Ш … = 4/3 cells); one copy per letter-cell = 2 cells), so
strokes on cell boundaries print exactly on grid lines — never stretch or crop them;
every length in a block is a whole number of 5mm cells (`model.js`); format А4/А5 is notebook-wide
and the sheet is drawn at real printable size; rows are `{elements, support}` picked in the row
panel (`RowInspector.jsx`, right side; bottom sheet on phones). UI copies `propis2`'s editor
model, palette and icons (copied, not imported from `src/features/propis2/`). Opens on «Мои тетради»
(`PrintLettersHome.jsx`): notebooks saved on the device and in the account (`print_letters:nb:<id>` kv
documents via the `accountKv` prop that `SessionScreen` passes to renderers — `src/topics/accountKv.js`),
plus ready notebooks defined in `library.js`. Screens use the device's full width (owner's rule). Since deck 0.2.1 the topic opens full-screen like `propis2` (`ParamsRoute` → `src/features/printLetters/PrintLettersScreen.jsx`, no session header) and its whole UI is a renamed copy of propis2's stylesheet/editor layout (`propis2-style.css`, `plb-`/`pl2-` prefixes). Since deck 0.2.5 a block can also be a syllable or word (`words.js`, `WordBlock.jsx`, «Блок» picker) — see «Слоги и слова» in the handoff. Registered in
`engineRegistry.js`/`registry.js`; deck ZIP built by `node tools/print_letters/build.mjs`, catalog status `release` since 2026-11-06 (open to all, paid access like `propis2`; was `beta`). Since deck 0.3.0 there is a second mode, «Пишу на экране» (`screen_write`): the child writes the letter with a finger on screen (levels «Обвожу»/«Сам» — «Смотрю» removed in 0.3.12; a stroke lifted too early or leaving the track burns), an ordinary session, not the full-screen constructor (since 0.3.1: one full-screen grid board, «Показать» writes the letter on the board itself, only prev/next letter under it, looping session with the usual star series and video reward; since 0.3.6 the board is the ordinary notebook grid, a letter 2 cells tall, wide letters 1½ cells on screen only (`screenGlyph`; printed sheets keep ⅔), red ruler ticks on the top and bottom lines of the letter's own cells only (½ long, ¼ ¾ short) mark where strokes start; since 0.3.9 a sample card in the board's corner shows the letter to write and is the «Показать» button, and the grid fills the whole working area (the renderer runs under the session header's empty badge space); since 0.3.10 the lesson ends on «Мои буквы» — the child's written letters (renderer → `onCorrect(…, {work})` → `session.works`, `mode.summaryOnFinish`), saveable as an A4 PDF (`src/features/session/PrintLettersWorks.jsx`); since 0.3.11 the set (letters × copies) is the lesson again (`finite`), the summary shows no «Молодец», and the app-wide «Видео в конце занятия» switch (mode params `videoAtEnd`, `sessionEndsOnItsOwn`, `endVideo.js`) offers «Смотреть видео» on the summary of a session gone through to the end); since 0.3.13 «Лист для тетради» on «Мои буквы» saves the lesson's letters as a notebook (a 4-row block per letter) and opens it in the constructor, and «Спрятанная буква» is gone — read `docs/print-letters-screen-writing.md` first (owner's decisions, what's done, what isn't); code in `src/topics/renderers/print_letters/screenWrite/`. Since deck 0.4.0 a third mode, «Почини букву» (`fix_letter`): a game of cards — a big letter with strokes shifted / tilted (one end) / a half-oval mirrored, the child drags them back (every part moves, a straight stroke by the middle or by either end, a magnet snaps it in), then the next letter; since 0.4.1 the letter is checked by its shape — a part snaps into any free place it matches (Е's bars are interchangeable); since 0.4.2 few settings (owner: no pile of settings) — «Сложность» (Легко / Средне / Трудно); since 0.4.3 the ovals of О Ю С Э are cut into a top and a bottom arc (О/Ю arcs mirror upside down, С/Э sideways, one mirrored half at most); since 0.4.4 no letter choice — all 33 letters in random order, «Сложность» is the only setting; read `docs/print-letters-fix-letter.md` first; code in `src/topics/renderers/print_letters/fixLetter/` (the breaking rules that keep the letter recognisable are in `breakLetter.js`, tested on all 33 letters); the board is shared with `screen_write` (`screenWrite/board.jsx`, `boardGeometry.js`). Since deck 0.5.0 a letter row in the constructor is one of three tasks (`row.task`, `tasks.js`): «Пишем букву», «Допиши штрих» (the letter without one stroke, hints only «точка начала» / none) and «Найди и обведи» (the block's letter among light lookalikes); the target is always the plate's letter, and «Готовые тетради → Задания → Спрятанные буквы» is a 2-page set (Г → П, Л → А, И → Й, Ь → Б, Ь → В) — see the top of the «Handoff» in `docs/print-letters.md`.

## Important

- Synology/SmartNAS is allowed only as backup storage, not as a backend/runtime target.
- After pushing to `main`, verify `https://app.mironium.com/api/version` and `/` both respond before considering a deploy done.
- `railway.json`'s builder must stay `"DOCKERFILE"` — Railpack/Nixpacks auto-detect has historically misidentified this repo as a static site.
- Rotate any token or password that was ever committed, pasted into docs, or embedded in git remotes.

## iOS Safe Area (notch / Dynamic Island / home indicator) — mandatory check

The app runs as an iOS PWA with `viewport-fit=cover`. Any screen-level element pinned to
a screen edge — header, footer, floating close/back/action button, bottom sheet — renders
under the iPhone status bar/notch/Dynamic Island or the home-indicator bar if it doesn't
reserve space for it, and its buttons become untappable there. This has been a recurring
bug (fixed piecemeal multiple times: `.home-header`, `.session-topbar`, `.planner-header`,
`.chat-header`, `.shs-root`, `.admin-lock-fab`, `.worksheet-close-button--floating`,
`.video-reward-close`, and others — audited and fixed 2026-07-06).

**Rule — apply this in the same diff that adds or edits any screen-level fixed/sticky/
absolute-positioned element, not as a follow-up:**

- Global CSS variables already exist in `src/styles.css` (`:root`): `--app-safe-top`,
  `--app-safe-right`, `--app-safe-bottom`, `--app-safe-left` (backed by
  `env(safe-area-inset-*)`, boosted under `html.app-ios-standalone`). Use them — do not
  invent new ones.
- Top bars: `padding-top: calc(<original> + var(--app-safe-top, 0px))`.
- Bottom bars/sheets: `padding-bottom: calc(<original> + var(--app-safe-bottom, 0px))`.
- Floating buttons pinned to a corner (`position: fixed`/`absolute` + `top`/`right`/
  `bottom`/`left`): add the matching `var(--app-safe-*, 0px)` to that offset, e.g.
  `top: calc(12px + var(--app-safe-top, 0px)); right: calc(12px + var(--app-safe-right, 0px));`.
- Reusing an existing shared class (`.screen-header`, `.planner-header`, `.home-header`,
  `.session-topbar`) already covers this — no extra work needed. The bug only appears
  when a **new** header/footer/floating-button class is introduced.
- Before calling a new/changed screen done, grep the touched CSS for
  `position:\s*(fixed|sticky|absolute)` and confirm every rule with a `top`/`right`/
  `bottom`/`left` offset that reaches a real screen edge has the variable baked in.
- To verify without a physical device (Playwright or devtools console):
  ```js
  document.documentElement.classList.add('app-ios-standalone');
  document.documentElement.style.setProperty('--app-safe-top', '59px');   // Dynamic Island
  document.documentElement.style.setProperty('--app-safe-bottom', '34px'); // home indicator
  ```
  then screenshot the screen — anything now cramped or overlapping the top/bottom edge
  needs the fix above.

