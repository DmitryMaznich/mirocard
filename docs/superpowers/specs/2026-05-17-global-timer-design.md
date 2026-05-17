# Global Timer — Design Spec
Date: 2026-05-17

## Overview

Глобальный таймер-виджет, доступный на любом экране приложения. Циферблат выдвигается из-за левого края экрана — физическим CSS-скольжением. Язычок всегда видим и показывает цифровой обратный отсчёт когда таймер запущен и скрыт.

## Architecture

### Новые файлы

- `src/features/timer/TimerContext.jsx` — React Context с глобальным состоянием таймера
- `src/features/timer/GlobalTimer.jsx` — компонент-синглтон, монтируется в App.jsx поверх всех экранов

### Изменения существующих файлов

- `src/App.jsx` (или аналог) — добавить `<TimerProvider>` и `<GlobalTimer />` в корень
- `src/features/timer/AnalogTimer.jsx` — удалить: compact-режим, drag-and-drop (floatDragRef), пропсы `compact`/`noListenMode`/`onClose`; SVG-циферблат и логика отсчёта переиспользуются внутри GlobalTimer
- `src/topics/renderers/reading/index.jsx` — удалить: `useState(showTimer)`, FAB-кнопку `⏱`, `<AnalogTimer compact ... />`

### TimerContext API

```js
{
  timeLeft,   // number, секунды
  isRunning,  // bool
  isPaused,   // bool
  isOpen,     // bool — выдвинут ли циферблат
  setOpen,    // (bool) => void
  start,      // () => void
  pause,      // () => void
  reset,      // () => void
}
```

Провайдер оборачивает всё приложение — любой экран может читать состояние через `useTimer()`.

## Visual Behavior

### Позиционирование

Контейнер `GlobalTimer` — `position: fixed`, вертикально по центру:

```css
position: fixed;
top: 50%;
transform: translateY(-50%) translateX(var(--timer-x));
z-index: 200;
transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
```

Две позиции:
- **Закрыто:** `--timer-x = calc(-1 * R + tab-width)` — циферблат за экраном, язычок торчит
- **Открыто:** `--timer-x = calc(50vw - R)` — циферблат по центру экрана

`R` = радиус циферблата ≈ `45vmin`.

### Анимация

Движение — CSS `transition: transform` (не opacity/display). Физическое скольжение вправо при открытии, влево при закрытии.

### Открытие / закрытие

- Тап/клик по язычку → toggle (открыть/закрыть)
- Свайп влево по циферблату → закрыть
- Тап вне циферблата → закрыть

## Tab (Язычок)

**Форма:** `32px × 72px`, правые углы закруглены, левые — примыкают к краю циферблата. Крепится к правому краю SVG-круга, вертикально по центру. Лёгкая тень вправо (`box-shadow`) для эффекта "выглядывает из-за стены".

### Три состояния

| Состояние | Вид |
|---|---|
| Таймер не заведён | иконка `⏱`, cream/бежевый фон |
| Запущен + скрыт | `02:34` повёрнуто (`rotate(-90deg)`), accent-фон, пульсирующий `box-shadow`, hover → `translateX(+4px)` + подсветка фона |
| Пауза + скрыт | `02:34` серым, без пульса, без hover-сдвига |

**Цифровой отсчёт:** моноширинный шрифт, текст повёрнут вдоль язычка (`rotate(-90deg)`).

**Пульсация:** `box-shadow` плавно разрастается и сужается (`@keyframes`) — не мигание, а "дыхание".

## Migration

### reading/index.jsx

Удалить:
```jsx
const [showTimer, setShowTimer] = useState(false);
{showTimer && <AnalogTimer noListenMode compact onClose={() => setShowTimer(false)} />}
{!showTimer && <button className="instruction-timer-fab" onClick={() => setShowTimer(true)}>⏱</button>}
```

При необходимости открыть таймер программно — вызвать `setOpen(true)` из `TimerContext`.

### AnalogTimer.jsx

Удалить:
- Пропсы `compact`, `noListenMode`, `onClose`
- Refs и handlers: `floatElRef`, `floatDragRef`, `handleFloatGrabDown`, `handleFloatGrabMove`
- CSS-классы `.analog-timer-float`, `.analog-timer-float__handle`, `.analog-timer-float__close`

SVG-циферблат, логика отсчёта, звук — остаются, переиспользуются в `GlobalTimer`.

## Success Criteria

- Язычок виден на всех экранах приложения (главный, тема, карточка, настройки)
- Циферблат физически скользит при открытии и закрытии
- Когда таймер запущен и скрыт — язычок показывает цифровой обратный отсчёт с пульсацией
- Hover на язычке с запущенным таймером — плавный сдвиг +4px вправо
- Старый floating-таймер и FAB-кнопка в инструкциях удалены
