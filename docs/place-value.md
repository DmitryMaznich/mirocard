# «Разряды числа» (place_value)

Split out of «Сложение и вычитание в столбик» (`column_addition`) on 2026-10-07:
the three coin modes — «Собери число» (`build_number`), «Какое это число?»
(`identify_number`), «Разменяй десяток» (`regroup_ten`, since replaced by «Обмен
десятка» `exchange_ten`, see `docs/place-value-methodology.md`) — are numeration
(разрядный состав), not column arithmetic, and use a different visual language
(coins and stacks of ten vs. the checkered notebook). Not merged into «Домики
чисел»: in school usage «состав числа» means 7 = 3 + 4 within 10; this topic is
«разрядный состав» (34 = 3 дес. + 4 ед.).

## Where things are

- Renderer + engine: `src/topics/renderers/place_value/` (files moved verbatim
  from `column_addition/`; `index.jsx` just dispatches by `task.type`).
- Modes / methodology / about: `DEFAULT_MODES.place_value`,
  `DEFAULT_MODE_METHODOLOGY.place_value`, `DEFAULT_TOPIC_ABOUT.place_value` in
  `src/topics/topicLoader.js`; release copy in `src/topics/releaseTopicCopy.js`.
- Deck: `public/place_value_topic.json` → `node scripts/make_place_value_zip.mjs`
  → `public/decks/place_value_v<version>.zip` (topic.json only, no renderer
  code — the renderer ships in the app bundle, like column_addition).
- `column_addition`'s release copy has `allowedModeIds` without the three moved
  modes, so already-installed records drop them on the next read instead of
  keeping them as leftover "custom" modes.
- The finger modes left column_addition the same day (to addition_subtraction,
  see `docs/addition-subtraction-design-review.md`); column_addition now has only
  «Столбик — Тренажёр» and «Контрольная работа».
- Students who used these modes inside column_addition need to install the new
  topic; their old stats stay under `column_addition`.

## Methodology rework of the three coin modes

In progress: `docs/place-value-methodology.md` (in Russian) is the agreed
direction for redesigning «Собери число», «Какое это число?» and «Разменяй
десяток» into a four-step ladder. Read it before touching these modes.

## Handoff — state on 2026-10-19 (read this first)

The topic was worked on for weeks in one long session with the owner (a
speech-therapy methodologist; children with ASD, minimally verbal). This
section is what a new session needs to continue. Decisions and their reasons,
mode by mode, are in `docs/place-value-methodology.md` sections 9–23 — read
the ones for the mode you touch; they record what was tried and rejected.

### The menu as shipped (app v1.0.2657)

1–6 up to 100, 7 test, 8–13 hundreds, 14 test:
1. Двузначные: читаем и пишем (`number_names`) · 2. Собери десяток (`group_ten`)
· 3. Какое это число? (`identify_number`) · 4. Собери число (`build_number`)
· 5. Разрядные слагаемые (`place_parts`) · 6. Плюс и минус через десяток
(`exchange_ten`) · 7. Контрольная работа: до 100 (`pv_test_100`)
· 8. Трёхзначные: читаем и пишем (`number_names_hundreds`) · 9. Считаем
десятками (`count_tens`) · 10. Сотни: какое это число? (`identify_hundreds`)
· 11. Сотни: собери число (`build_hundreds`) · 12. Разрядные слагаемые до 1000
(`place_parts_hundreds`) · 13. Плюс и минус через сотню (`exchange_hundred`)
· 14. Контрольная работа: сотни (`pv_test_1000`).
Modes 8, 10–14 are built in `topicLoader.js` from the base modes by `hundreds()`
/ `check()` (after `DEFAULT_MODES`); `releaseTopicCopy.js` `allowedModeIds` +
`about.flow` must list every mode.

### Files (all in `src/topics/renderers/place_value/` unless noted)

- `engine.js` — all task generation, `modeParams`/`internalParams` (simple
  parent settings → detailed generator params), checks (`CHECK_SKILLS`,
  `generateCheckTasks`, `checkResultRows`, `checkTaskText`).
- `index.jsx` — dispatch, `AudioGate` (voiced tasks wait for all 43 clips),
  `CheckTask` (one try, freeze 1 s, passes the child's answer on).
- Screens: `GroupTenTask`, `IdentifyNumberTask`, `BuildNumberTask`,
  `TableTasks` (table/number views + `PlaceChoiceRows`), `HundredsTasks`,
  `PlacePartsTask`, `CountTensTask`, `NumberNamesTask`, `ExchangeTenTask` →
  `ExchangeTable` (to 100, table) / `ExchangeHundred` (hundreds, scheme + table),
  `ExchangeFlight` (borrow animation as scheme, `CarryDigit`, `EnoughChoice`).
- Pieces: `CoinBlocks.jsx` (`modelPieces(view)`: coins = coin/stack/plate,
  scheme = dot/stick/square). Audio: `numberAudio.js`, `useSpeechGuard.js`
  (a tap cuts the voice), `public/sw.js` caches `/audio/place-value-numbers/`.
- Session-side: `src/features/session/PlaceValueCheckResult.jsx` (test result:
  bars, «Стоит повторить», list of mistakes from `statistics.wrongAnswers`),
  `ParamsScreen.jsx` (EnumParam `ordered` arrows + `hint`, `startRequires`),
  `ModePickerScreen.jsx` (any «Контрольная работа» on a pale yellow tint).
- Tests: `*.smoke.test.jsx` next to the screens (coinHarness, fake timers).

### Owner's rules learned the hard way (don't relitigate)

- Speak Russian, plain, no flattery, ≤ ~1000 tokens; be a sparring partner —
  argue when you disagree, give one recommendation, not a survey.
- Screens never jump: reserve space for anything that appears later («Далее»,
  hint tables). Size from the viewport (`clamp` with `vh`/`vw`), check phone
  390×844, short phone 375×617, tablet 820×1180 and 1180×820.
- No ready-made answers after a mistake: the child decides (e.g. wrong
  «Хватает?» → «Что больше: 1 или 3?», both digits lit).
- Nothing on screen may give away the answer of a later step.
- «Как показываем» (coins / scheme / table / none) is one set for all places,
  never mixed per place; table is notation, not a picture.
- Plus/minus «Таблица» follows the classic Russian column notation: borrow —
  the digit borrowed from is crossed with a dot over it (the dot pulses at the
  step whose answer goes there, then the answer replaces it); the receiving
  digit is NOT crossed, a small «1» over it on the left (animation: scheme
  pieces → the digit reads as a big 13 → its 1 slides up). Carry — the sum is
  written under its column, its left «1» flies up over the next column (digits
  only, no pieces). With tens to subtract after a borrow: two steps («9 − 1»
  over the 9, then «8 − 6»), not a chain. Steps below in two lines: place chip
  big, then the sum big.
- Tests (7, 14): skills and pictures are switches, all off by default, tasks
  random, one try, no hints; result lists each mistake with the child's answer.
- Titles: «Послушай», not «Услышь»; no «дес./ед.» abbreviations on screens.
- Every proposal about a screen comes with a mockup (PNG on the real component
  — the harness in "How to work" step 5), before any code.

### How to work (procedure used for every change)

1. `cp backend/generated/topic-inventory.json <scratch>/inv.json` — the build
   regenerates it and changes OTHER topics' status/access; restore it after
   `npm run build` and only hand-edit lines you mean to change. Also
   `git checkout public/audio-review-manifest.json` after a build.
2. `npx vitest run` — push only with zero «failed» (one flaky full run once
   slipped through).
3. Commit, `npm version patch --no-git-tag-version`, separate «chore: release
   vX» commit, `git push origin HEAD:main` (Railway auto-deploys), verify with
   Railway `list-deployments` (project 6e0d74c4-…, service 177c0686-…); the
   sandbox proxy may block app.mironium.com itself.
4. place_value is in the main bundle (its deck ZIP is topic.json only) — no
   renderer ZIP rebuild. `comparison` IS a deck-zip topic (see CLAUDE.md).
5. Screenshots: a throwaway Vite harness (index.html + entry.jsx that renders
   one screen with a task from `generateTasks` or a JSON override, built with
   `vite-plugin-singlefile`), Playwright with
   `executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome`; the
   owner wants to SEE screens (send PNGs) before/after layout changes.

### Also done in this period outside place_value

- `comparison` level 5 «По разрядам (до 1000)»: pairs with traps (47/74,
  305/350, 99/100, 300/299), after a mistake a place table with the deciding
  place; only in «4. Сравни и поставь знак» (with hint) and «7. Контрольная
  работа» (without); deck v2.37.0 (`engine.js`, `PlaceHint.jsx`).

### Open / next (owner's priorities so far)

- Watch on real sessions: borrow animation length (~3.3 s) and piece size on
  phones; whether the picture in «Разрядные слагаемые» makes 47 = 40 + 7 too
  easy (option: show it only after a mistake).
- «Сравнение по разрядам до 100» (a smaller step than level 5).
- Addition with carry still asks «3 + 2 + 1» as one chain — owner hasn't asked
  to split it; ask before changing.
- Mode 10 table redone as rows «3 сотни / 0 десятков / 5 единиц» + three
  answer cells (methodology §24); since 2026-10-23 mode 3 and test 7 use the
  same screen with two rows / two cells, and modes 3 and 10 have «Сколько в
  разряде: цифрами / словами / микс» («шесть десятков», methodology §25).
- Thousands: start with «places count from the right» — split «1 305» into
  classes (owner's idea of writing from the units, kept for this stage).
- Thousands (box of 10 plates «1000», range до 10 000) — the next big stage;
  agreed to wait until hundreds are tried with children.
- Known: other topics' catalog/inventory mismatch (report, don't fix);
  `sync-release-topic-copy --check` fails on `reading_short_stories` (not ours).

## Original plan (2026-10-07, mostly done — kept for history)


The topic is named for the whole ladder, not only tens: hundreds and thousands
are the next difficulty. Plan:

1. Extend the three existing modes with a range: до 100 / до 1000 / до 10 000.
   Model: coin (1) → stack of 10 coins (10) → **plate of 10 stacks** (100, still
   proportional — must visibly be ten stacks) → **box of 10 plates labelled
   «1000»** (deliberately non-proportional: by then the child must trust the
   exchange rule, not count). Draw and screenshot before wiring in.
   «Разменяй» generalizes to hundred → tens and thousand → hundreds.
2. New modes, one at a time:
   - «Запиши в таблицу разрядов» — model → digits per column, focus on
     placeholder zero (305, 340, 300).
   - «Разрядные слагаемые» — 347 = 300 + 40 + 7 and back.
   - «Считаем через сотню» — number line 90, 100, 110 … 990, 1000.
   - «Послушай и запиши» — hear «триста пять», write 305 (speech-therapy core:
     children write 3005 / 35). Needs recorded number audio above 100 — same
     GEMINI_API_KEY blocker as `docs/addition-subtraction-design-review.md`.
3. One colour per place (ones / tens / hundreds) across model, table and digits
   — the bridge from objects to notation.

Typical stumbling points to design against: placeholder zero; irregular names
(двести, триста, пятьсот, сорок, девяносто); crossing a round number (190 → 200);
«сколько всего десятков в 340?» = 34, not 4.
