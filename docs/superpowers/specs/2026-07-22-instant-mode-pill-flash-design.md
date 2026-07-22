# Вспышка пилюли на финальный ответ в instant-режимах column_addition

## Контекст

В предыдущей итерации ([2026-07-21-session-pill-answer-feedback-design.md](2026-07-21-session-pill-answer-feedback-design.md))
пилюля `.session-plan-tongue` в хедере сессии стала индикатором правильности ответа —
показывает 😊/😢 при `sessionState.status === "answer_correct"/"answer_incorrect"`.

После деплоя выяснилось: в теме «Сложение и вычитание в столбик» (renderer `column_addition`)
пилюля не реагирует даже на финальный (решающий) ответ ребёнка в четырёх режимах —
`fingers_count`, `build_number`, `identify_number`, `regroup_ten`. Причина — у них
`mode.evaluation === "instant"`. В этом режиме evaluation `useSessionEngine.js`
(`onCorrect`/`onIncorrect`) уходит в `handleInstantCorrect`/`handleInstantIncorrect`
(`sessionEngine.js`), которые **атомарно** возвращают `status: "task_active"` — состояние
`"answer_correct"`/`"answer_incorrect"` для этих режимов не существует ни одного тика,
даже на самый решающий, последний ответ ребёнка. Это осознанное архитектурное решение:
instant-режимы — это непрерывная ручная манипуляция (двигать палец вверх/вниз, тащить
монетку), и пауза-подтверждение после каждого микро-действия сломала бы поток
взаимодействия. Но у самого понятия «финальный решающий ответ» (в отличие от промежуточной
возни) при этом нет отдельного сигнала в движке — оно нигде не помечено как особый момент.

Режим `column_arithmetic` («Столбик — Тренажёр») из той же темы использует
`evaluation: "auto"` и уже работает правильно — не входит в область этой задачи.

## Идея

Не трогать `sessionState.status`, `handleInstantCorrect`/`handleInstantIncorrect`,
стрик/наградную логику или таймеры авто-перехода instant-режимов вообще — весь риск
регрессии для уже отлаженного, специально «безпаузного» поведения этим полностью
исключается. Вместо этого — чисто косметическая, отдельная от `sessionState`
кратковременная «вспышка» пилюли, которая никак не участвует в реальной логике сессии.

## Как определяется «финальный ответ» — по рендереру

Все 4 instant-рендерera уже вызывают `onCorrect(conceptId, cardId)` **ровно один раз**,
строго в момент, когда финальный ответ подтверждён верным — амбигуации нет, новый код
для «вспышки-правильно» не нужен вообще, она включается на уровне `SessionScreen.jsx`.

Для «вспышки-неверно» — по рендереру:

- **`IdentifyNumberTask.jsx`** (`checkAnswer`) и **`BuildNumberTask.jsx`** (`handleDone`) —
  `onMistake?.(...)` уже вызывается ровно один раз, в момент финального неверного ответа.
  Амбигуации нет — добавляем новый колбэк `onFlashIncorrect?.(...)` рядом с существующим
  вызовом `onMistake`, без изменения смысла `onMistake` (счётчик `incorrectCount` как был).
- **`RegroupTenTask.jsx`** — это задача только на перетаскивание, неверного ответа не
  существует в принципе (`onMistake` там даже не принимается как проп). Изменений нет.
- **`FingersCountTask.jsx`** (`TwoPhaseTask`) — единственный неоднозначный случай:
  `onMistake?.(...)` сейчас вызывается в ДВУХ разных местах — (1) `confirm()`, несовпадение
  при подтверждении построенных на руках цифр (это подготовка к ответу, не сам ответ) и
  (2) `handleDigit()`, неверный ввод на цифровой клавиатуре (это и есть финальный ответ).
  `onFlashIncorrect?.(...)` добавляем **только** во втором месте (строка ~200,
  `handleDigit` else-ветка). Первое место (строка ~176, `confirm()`) не трогаем — там
  `onMistake` остаётся единственным сигналом, пилюля на него не реагирует.

## Плюмбинг

Новый проп `onFlashIncorrect: () => void` прокидывается по той же цепочке, что и
`onMistake`/`onCorrect` сейчас: `SessionScreen.jsx` → `<Renderer .../>` →
`column_addition/index.jsx` (`ColumnAdditionRenderer`) → в `FingersCountTask`,
`BuildNumberTask`, `IdentifyNumberTask` (в `RegroupTenTask` не прокидывается — там
нечему его вызывать).

В `SessionScreen.jsx`:

- Новое локальное состояние: `const [pillFlash, setPillFlash] = useState(null);`
  (`"correct" | "incorrect" | null`).
- `handleCorrect` (уже существует) — если `mode.evaluation === "instant"`, дополнительно
  `setPillFlash("correct")`.
- Новый `handleFlashIncorrect` — `setPillFlash("incorrect")`, передаётся в `Renderer` как
  `onFlashIncorrect={handleFlashIncorrect}`.
- `useEffect`, следящий за `pillFlash`: если не `null`, ставит `setTimeout(() =>
  setPillFlash(null), 900)` и чистит таймер при размонтировании/повторном срабатывании.
  900мс — примерно совпадает с уже имеющейся внутренней паузой этих задач перед переходом
  к следующей (700–1200мс у разных рендererов), так что вспышка не обрывается раньше, чем
  ребёнок успел её заметить, и не зависает поверх уже начавшейся следующей задачи.

## Как пилюля это увидит

Никаких изменений в `tonguePillState.js` или `SessionHeader.jsx` не требуется — пилюля
не отличает «настоящий» `sessionState.status === "answer_correct"` от вспышки, ей всё
равно передаётся ровно тот же проп `answerStatus`, что и раньше. В `SessionScreen.jsx`,
там же где сейчас `answerStatus={status}` передаётся в `<SessionHeader>`, вычисляем:

```js
const pillAnswerStatus = pillFlash
  ? (pillFlash === "correct" ? "answer_correct" : "answer_incorrect")
  : status;
```

и передаём `answerStatus={pillAnswerStatus}` вместо `answerStatus={status}`.

## Что не входит в объём

- `column_arithmetic` («Столбик — Тренажёр») — уже работает через `evaluation: "auto"`,
  не трогаем.
- Не меняется `incorrectCount`/`correctCount`, стрик-логика, таймеры авто-перехода,
  `sessionState.status` — вспышка полностью отделена от реальной логики сессии.
- Не меняется поведение build-фазы `FingersCountTask` (несовпадение рук при
  подтверждении) — пилюля на это не реагирует, только на финальный ввод цифр.
- Звук (`playFeedback`) не меняется — уже вызывается через существующие `onCorrect`/
  `onMistake` в `SessionScreen.jsx`, независимо от вспышки.
- Другие темы/рендererы с `evaluation: "instant"` за пределами `column_addition` (если
  такие есть) в объём этой задачи не входят — это точечное расширение только для тех
  4 режимов `column_addition`, где пользователь подтвердил проблему.

## Затронутые файлы

- `src/features/session/SessionScreen.jsx` — состояние `pillFlash`, таймер очистки,
  `handleFlashIncorrect`, расширение `handleCorrect`, вычисление `pillAnswerStatus`,
  проброс `onFlashIncorrect` в `<Renderer>`.
- `src/topics/renderers/column_addition/index.jsx` — приём `onFlashIncorrect` в
  `ColumnAdditionRenderer`, проброс в `FingersCountTask`, `BuildNumberTask`,
  `IdentifyNumberTask`.
- `src/topics/renderers/column_addition/FingersCountTask.jsx` — новый вызов
  `onFlashIncorrect?.()` только в `handleDigit` (финальный неверный ввод).
- `src/topics/renderers/column_addition/BuildNumberTask.jsx` — новый вызов
  `onFlashIncorrect?.()` в `handleDone` (неверная сборка числа).
- `src/topics/renderers/column_addition/IdentifyNumberTask.jsx` — новый вызов
  `onFlashIncorrect?.()` в `checkAnswer` (неверный ввод десятков/единиц).
