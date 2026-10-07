# «Разряды числа» (place_value)

Split out of «Сложение и вычитание в столбик» (`column_addition`) on 2026-10-07:
the three coin modes — «Собери число» (`build_number`), «Какое это число?»
(`identify_number`), «Разменяй десяток» (`regroup_ten`) — are numeration
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

## Planned next (agreed with the user)

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
   - «Услышь и запиши» — hear «триста пять», write 305 (speech-therapy core:
     children write 3005 / 35). Needs recorded number audio above 100 — same
     GEMINI_API_KEY blocker as `docs/addition-subtraction-design-review.md`.
3. One colour per place (ones / tens / hundreds) across model, table and digits
   — the bridge from objects to notation.

Typical stumbling points to design against: placeholder zero; irregular names
(двести, триста, пятьсот, сорок, девяносто); crossing a round number (190 → 200);
«сколько всего десятков в 340?» = 34, not 4.
