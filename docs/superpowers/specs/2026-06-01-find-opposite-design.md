# Режим find_opposite — дизайн

## Суть

Новый режим в теме «Противоположности». На экране стимульная карточка (один полюс) и пустой слот-мишень рядом. Внизу разбросаны карточки — правильный ответ и дистракторы. Ребёнок перетаскивает карточку-«неприятеля» в слот. Сложность регулируется количеством дистракторов и их семантической близостью.

## Файлы

| Файл | Действие |
|------|----------|
| `src/topics/renderers/opposites/FindOppositeTask.jsx` | Новый |
| `src/topics/renderers/opposites/engine.js` | +`generateFindOppositeTasks()`, +кейс в `generateTasks()` |
| `src/topics/renderers/opposites/index.jsx` | +роутинг `find_opposite → FindOppositeTask` |
| `src/topics/renderers/opposites/Opposites.css` | +секция `/* find-opposite */` |

`registry.js` и `engineRegistry.js` не трогаем.

## Task shape

```js
{
  type: "find_opposite",
  stimulusCard: card,
  options: [{ card, isTarget: bool }, ...]  // перемешаны
}
```

## Параметры режима

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| `distractorCount` | `2\|4\|6` | `2` | Количество дистракторов |
| `sameConcept` | `bool` | `false` | Дистракторы из того же `conceptId` |

## Движок — generateFindOppositeTasks(cards, params)

Для каждого уникального `objectId`:
1. Случайно выбрать стимул (left или right), противоположный полюс = правильный ответ.
2. Дистракторы:
   - `sameConcept: false` → карточки из **других** `conceptId`, любой полюс, случайно.
   - `sameConcept: true` → карточки того же `conceptId`, полюс правильного ответа, другие `objectId`.
3. Срезать до `distractorCount` штук, перемешать с правильным ответом → `options`.
4. Все задачи перемешать.

Итого задач = количество уникальных `objectId` в теме.

## Компонент — FindOppositeTask.jsx

**Структура экрана (layout A):**
- Инструкция: «Найди неприятеля — перетащи!»
- Зона пары: `[стимульная карточка]` `→` `[слот-мишень с пунктирной рамкой]`
- Зона кучи: карточки с лёгким случайным поворотом (-4…+4 deg, inline style)

**State:** `answered: bool`, `slotState: 'idle'|'active'|'correct'|'wrong'`

**Drag (pointer events):**
- `pointerdown` на карточке → drag start, ghost-элемент следует за курсором/пальцем
- `pointermove` → перемещает ghost
- `pointerup` → hit-test слота через `getBoundingClientRect()`
  - Попадание + `isTarget` → `slotState='correct'`, через 900 мс `onCorrect()`
  - Попадание + `!isTarget` → `slotState='wrong'`, через 900 мс `onIncorrect()`
  - Нет попадания → ghost исчезает, карточка возвращается (без обратной связи)
- После `answered=true` все pointer-события игнорируются

**Props:** `task`, `topicId`, `onCorrect`, `onIncorrect`

## CSS — новая секция /* find-opposite */

| Класс | Назначение |
|-------|-----------|
| `.opp-fo__pair` | flex-строка: стимул + слот |
| `.opp-fo__slot` | пунктирная рамка мишени |
| `.opp-fo__slot--active` | синий highlight при наведении |
| `.opp-fo__slot--correct` | зелёный после правильного дропа |
| `.opp-fo__slot--wrong` | красный + shake-анимация |
| `.opp-fo__scatter` | зона кучи, flex-wrap |
| `.opp-fo__card` | карточка в куче |
| `.opp-fo__card--dragging` | полупрозрачность при drag |
| `.opp-fo__ghost` | абсолютный ghost-элемент |

## Поведение при ошибке

Ошибка засчитывается при дропе неверной карточки в слот. `onIncorrect()` вызывается через 900 мс. Нет многократных попыток — задача закрывается как и в `choose_two`.
