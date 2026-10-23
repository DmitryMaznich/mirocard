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

## Next

- «Найди ошибку» — new mode, mockup shown to the owner 2026-10-23, waiting for
  a go: a solved column with one typical mistake (carry written but not added,
  smaller digit taken from the larger, the borrowed-from digit not reduced,
  a 1-digit number under the hundreds, the zero not turned into 9 in
  305 − 7); the child taps the wrong digit of the answer, then types the right
  one; the hint is a question about that place.
