# «Сложение и вычитание в столбик» (column_addition)

Kept as its own topic (owner's decision, 2026-10-23): «Разряды числа» teach the
number through pictures, the column is the school's written algorithm — a
different level. The two topics point at each other in their mode tips
(«Плюс и минус через сотню» → this topic; «Столбик — Тренажёр» → start after
modes 13–14 of «Разряды числа»). The app has no topic-to-topic button.

Numbers stay within three digits: once three digits are mastered, the app is
no longer needed for the column.

## Modes

- «Столбик — Тренажёр» (`column_arithmetic`): step-by-step on the notebook grid.
  «Числа в примере» (since 2026-11-15, replaced the «Разрядность» list of
  abbreviations; owner's design): the setting is drawn as the column — two
  rows of 3 tappable cells, the sign, the line, «Например: 305 − 7» under it
  (`src/features/session/ColumnOperandsParam.jsx`). Every cell of both rows
  works the same (owner: one gesture, one meaning — no «×», no hidden rules):
  an empty cell — the number grows to it; a marked cell — 0 there if a 0 can
  stand there, otherwise (the leading digit) the cell goes off; a 0 again —
  any digit. What a cell means is a small legend right of the cells (a mini
  cell of each state: «любая цифра», «ноль», «разряда нет»); the example's ↻ shows another one. Either number
  may be the longer with «+» (25 + 326 — the trainer draws a shorter top
  number with an empty cell, `hasTopDigit`); with «−» the bottom is no
  longer than the top — its extra cells go dim, a longer saved bottom is cut
  (owner: just limit it, no notes); in «Микс» the setting stays free and only
  the subtraction examples cut the bottom to the top's length. Param `operands` =
  `{top, topZeros, bottom, bottomZeros}` (1…3 digits, zero places from the
  units), type `column_operands`. An unmarked cell never draws a 0.
  `operandsExample` (`engine.js`) draws the numbers; the answer is as wide as
  the longer number (no new place in the trainer); a carry the numbers can't
  have (40 + 50 «С переносом») — examples come without it and the setting
  says so. Old saved `digits` map onto it (`resolveOperands`; ParamsScreen
  does it when the settings open). Three cells: the trainer stays within
  three digits — four would mean thousands (owner agreed).
- **«Контрольная работа» moved to «Контрольные по математике» (2026-11-16, owner).** The mode list shows
  `column_tests_link` (type `topic_link`: `link: {topicId, title, text}`) — ParamsScreen opens
  `TopicLinkScreen` for it: the topic opens if installed, else the catalog opens on it (store
  `topicLibraryQuery`). `column_copy` stays `retired` (out of the lists; old plans and history
  resolve), its description below is history. The same link is to replace the checks of «Плюс и
  минус» and «Сравнение»; «Разряды числа» keep theirs (owner). `math_tests` is `release` since then.
- «Контрольная работа» (`column_copy`, rebuilt 2026-10-23, retired 2026-11-16): a sheet of examples
  in a line; the child sets them up in the notebook, types the answer, «✓».
  - «Какие примеры» — switches (`COPY_KINDS`): 2 + 2, 2 + 1, 3 + 3, 3 + 2,
    3 + 1, круглые, с нулём, новый разряд; the sheet mixes the ticked kinds
    (`generateCopySheet`), the same kind not twice in a row. Only «Новый
    разряд» changes the answer's width (95 + 7 = 102, 650 + 470 = 1120,
    102 − 7 = 95); «Перенос / заём» filters every other kind.
  - One try per example: right — green, wrong — red with the child's answer,
    next example. No answer cells (they told the answer's length).
  - After the last one — the adult's result: right of total, by kind (weak
    kinds in amber), mistakes with the right answer; «Новый лист» / «Готово»
    (reward video, then the session's `onCorrect`). Not written to session
    statistics yet.
  - Old saved «Разрядность» of this mode is not carried over: default is 2 + 2.
  - «Где решаем: в тетради / на планшете» (`solveOn`, settings only — the
    child can't switch it during the lesson). On the tablet the sheet has no
    keypad: a tap on an example opens it in the trainer (`ColumnArithmeticTask`
    with `noHints`: no 💡, no first-time hints card; compare on borrow as in the
    trainer), «← К листу» goes back. A slip inside doesn't burn the example —
    it counts once solved; the slips are counted, and the result says «Без
    ошибок N из M», by kind, and «С ошибками по ходу» with the count.

## Borrowing through a zero (fixed 2026-10-23)

The trainer used to ask for «−1» over the 0 in 302 − 195 (≈6 % of 3-digit
borrows got stuck: no such key). Now the school's order (`throughZero` in
`buildSubColumns`/`buildSubSteps`): the ones borrow, the hundreds are crossed
out first (3 → 2), then the 0 of the tens (→ 9), then the tens and hundreds are
counted. A leading zero of the answer is not written (102 − 7 = 95, 52 − 47 =
5): no step and no cell for it.

## One order for every place (2026-11-15)

Owner's decision after the mockup `docs/mockups/column-addition/2026-11-15-unified-steps.html`
— this is the solving style the math tests (`math_tests`, «Реши в столбик») are to follow too.
`buildAddSteps` / `buildSubSteps` (`engine.js`) build the steps from one rule, with no
separate branches for two or three places or for a zero:

- **Addition**, per place right to left: the result digit; 10 or more — «1» in the mark cell
  over the next place; with no next place the child writes that «1» in the answer
  (`result:overflow`, 95 + 7 = 102, 650 + 470 = 1120) — it used to stand there ready, and the
  cell now appears only on its turn (shown early it tells the answer's width).
- **Subtraction**, per place right to left: «2 − 7: единиц хватает?» → «Хватает» / «Не
  хватает» (the words of «Разряды числа», owner: the bridge between the topics; it replaced
  the < > = strip); not enough → **take — give — reduce** (owner, 2026-11-16; the first version
  reduced first): the lender lights up (`.col-digit--lender`, the borrow step's `lenders`; a 0
  between lights up too) while the «1» goes in front of the place's own number; then the lender is
  crossed out and written one less in the mark cell over it (a 0 between becomes 9); then the result.
- The mark cell over a place holds its current top number; a place that lent and then
  borrows (532 − 157, the tens) gets its «1» in front of that mark — «12». The old corner
  mark held both and the «1» overwrote the «2» (the 3-digit bug). A place with no mark keeps
  the «1» in the digit's corner.
- Every step carries `column` (the place being worked); the first step of a place carries
  `first`, `have` (top number now) and `need` (bottom digit, null if none) — the question is
  asked there. «При заёме» (`onBorrow`) asks only where a borrow comes — the answer is then
  always «Не хватает», a prop for the ritual; «Всегда» is the real decision.
- 102 − 7: the hundreds lent down to 0 are crossed out with no «0» over them; a leading zero
  of the answer is not written.

## One record with «Контрольные по математике» (2026-11-15)

Owner chose «с 1» (mockup `docs/mockups/column-addition/2026-11-15-one-style.html`): the trainer and
«Реши в столбик» of `math_tests` write the column the same way, as a pen in a notebook —
- everything the child writes besides the answer is a small digit in the child's blue (`#1d4ed8`,
  math_tests `COLORS.child`) in the marks row over its place: the carried «1»; the lent-down digit
  over a crossed-out one (crossed in the same blue); the borrowed «1» in front of the place's number —
  in front of that mark («12»), or, over a digit not crossed, low on the left of its mark cell;
- no yellow triangles, corners or tints any more (`.col-carry-cell`, `.col-digit-corner` are gone);
  the place to write next is a small dashed yellow box (`.col-mark-part--slot`, math_tests' focus box);
- in `math_tests` a subtraction mark is written from the right like the answer: 2, then 1 → «12»
  (`SolveView.jsx` typeDigit / erase; the mark blank carries `op`), and `layout.js` draws the «1»
  in front, the same size as every mark (owner: one size, as in a notebook), a lone «1» over an uncrossed digit at the left of its cell. Marks are still not
  graded there.

## Copying the numbers is not graded (2026-11-15)

Setting the example up in the column: a wrong digit (or the line too early) only shakes the cell —
a slip of the finger, not a mistake to count (owner). A wrong sign still counts: «+» and «−» look
alike, so picking the sign is the child's decision. Same in the tablet check (slips).

## Next

- «Найди ошибку» — new mode, mockup shown to the owner 2026-10-23, waiting for
  a go: a solved column with one typical mistake (carry written but not added,
  smaller digit taken from the larger, the borrowed-from digit not reduced,
  a 1-digit number under the hundreds, the zero not turned into 9 in
  305 − 7); the child taps the wrong digit of the answer, then types the right
  one; the hint is a question about that place.
