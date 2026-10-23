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
  «Разрядность» since 2026-10-23 also has 3 + 2, 3 + 1, «Круглые до 1000», «С
  нулём» — numbers from the check's kinds (`trainerTaskOfKind`, `engine.js`);
  the grid is as wide as the top number, the answer never grows a place.
- «Контрольная работа» (`column_copy`, rebuilt 2026-10-23): a sheet of examples
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

## «Найди ошибку» (column_find_error, 2026-10-23)

`FindErrorTask.jsx`, `generateFindErrorTask` in `engine.js`. A solved column
(numbers set up, answer below the line, no carry/borrow marks — as a classmate
would leave it) with exactly one wrong digit, from a typical mistake taken in
turn (`turn`, else counting slips crowd out the rest): carry forgotten
(47 + 25 = 62), the digit lent from not reduced (52 − 27 = 35), the zero lent
through not turned into 9 (305 − 7 = 208, 3-digit only), a slip in one place.
Only mistakes that change one digit and keep the answer's width. The child taps
the wrong digit (a right one: «Эта цифра верная… Проверь другой разряд»), then
types the right digit on the keypad (its place kept from the start); a wrong
digit gets a question about that place (formula with no-break spaces), the
right one names the mistake; «Далее». Settings: «Операция», «Разрядность»
(2, 3, микс). Mode order: Тренажёр → Найди ошибку → Контрольная работа.

Deck ZIP `column_addition_v1.3.3` carries the new about-copy
(`releaseTopicCopy.js`); `scripts/sync-release-topic-copy.mjs` currently stops
on `reading_short_stories`, so it was run for this topic only.

Possible next step: sometimes «Ошибки нет» (a correct solution to confirm).
