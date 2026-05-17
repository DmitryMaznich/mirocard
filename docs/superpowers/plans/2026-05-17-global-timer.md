# Global Timer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить floating-таймер глобальным виджетом, который выдвигается с левого края любого экрана через язычок с цифровым обратным отсчётом.

**Architecture:** `TimerContext` хранит `isOpen`/`timeLeft`/`isRunning` глобально. `GlobalTimer` — фиксированный контейнер (всегда в DOM), скользящий по translateX; содержит `AnalogTimer` внутри панели и язычок снаружи. `AnalogTimer` синхронизирует своё состояние в контекст и читает `setIsOpen` вместо `onClose` пропа.

**Tech Stack:** React 18, CSS custom properties + transition, pointer events (swipe-to-close)

---

## File Map

| Действие | Файл |
|---|---|
| Создать | `src/features/timer/TimerContext.jsx` |
| Создать | `src/features/timer/GlobalTimer.jsx` |
| Изменить | `src/features/timer/AnalogTimer.jsx` |
| Изменить | `src/main.jsx` |
| Изменить | `src/App.jsx` |
| Изменить | `src/features/home/HomeScreen.jsx` |
| Изменить | `src/topics/renderers/reading/index.jsx` |
| Изменить | `src/styles.css` |

---

## Task 1: Create TimerContext.jsx

**Files:**
- Create: `src/features/timer/TimerContext.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/features/timer/TimerContext.jsx
import { createContext, useContext, useState } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  return (
    <TimerContext.Provider value={{ isOpen, setIsOpen, timeLeft, setTimeLeft, isRunning, setIsRunning }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/timer/TimerContext.jsx
git commit -m "feat(timer): add TimerContext for global timer state"
```

---

## Task 2: Wrap app in TimerProvider

**Files:**
- Modify: `src/main.jsx:77-81`

- [ ] **Step 1: Add TimerProvider import to main.jsx**

В начале файла `src/main.jsx` добавь импорт:
```js
import { TimerProvider } from "@/features/timer/TimerContext";
```

- [ ] **Step 2: Wrap the render call**

Найди строки 77-81 и замени:
```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```
На:
```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TimerProvider>
      <App />
    </TimerProvider>
  </StrictMode>
);
```

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat(timer): wrap app in TimerProvider"
```

---

## Task 3: Refactor AnalogTimer.jsx

**Files:**
- Modify: `src/features/timer/AnalogTimer.jsx`

Цель: убрать compact-режим, float drag, пропсы `compact`/`noListenMode`/`onClose`; синхронизировать `secondsLeft` и `running` в TimerContext; вместо `onClose?.()` вызывать `setIsOpen(false)`.

- [ ] **Step 1: Удалить ненужные импорты и изменить сигнатуру**

Найди строку 66:
```jsx
export default function AnalogTimer({ rewardVideos = [], onClose, noListenMode = false, compact = false }) {
```
Замени на:
```jsx
export default function AnalogTimer({ rewardVideos = [] }) {
```

- [ ] **Step 2: Добавить useTimer в начале тела функции (после строки 66)**

Сразу после открывающей скобки функции добавь:
```jsx
  const { setIsOpen, setTimeLeft, setIsRunning } = useTimer();
```

И в начале файла добавь импорт (рядом с другими React-импортами):
```jsx
import { useTimer } from "./TimerContext";
```

- [ ] **Step 3: Удалить float refs (строки 93-94)**

Удали строки:
```jsx
  const floatElRef = useRef(null);
  const floatDragRef = useRef(null);
```

- [ ] **Step 4: Синхронизировать состояние в контекст**

После строки `const normalizedRewardVideos = normalizeRewardVideoIds(rewardVideos);` добавь два useEffect:

```jsx
  useEffect(() => { setTimeLeft(secondsLeft); }, [secondsLeft, setTimeLeft]);
  useEffect(() => { setIsRunning(running); }, [running, setIsRunning]);
```

- [ ] **Step 5: Исправить hardReset — заменить onClose на setIsOpen**

Найди в `hardReset` строку (около 315):
```jsx
    if (close) onClose?.();
```
Замени на:
```jsx
    if (close) {
      setTimeLeft(0);
      setIsRunning(false);
      setIsOpen(false);
    }
```

- [ ] **Step 6: Удалить float drag функции**

Найди и удали три функции (строки ~405-431):
```jsx
  function handleFloatGrabDown(e) { ... }
  function handleFloatGrabMove(e) { ... }
  function handleFloatGrabUp() { ... }
```

- [ ] **Step 7: Удалить noListenMode из JSX**

Найди строку ~728:
```jsx
                {!running && !noListenMode && (
```
Замени на:
```jsx
                {!running && (
```

- [ ] **Step 8: Удалить compact branch и изменить корневой div**

Найди и удали весь блок compact (строки ~579-606):
```jsx
  if (compact) {
    return (
      <div ref={floatElRef} className="analog-timer-float" ...>
        ...
      </div>
    );
  }
```

Затем найди строку ~608-611:
```jsx
  return (
    <div
      className="analog-timer-overlay"
      onTouchStart={preventMultiTouchZoom}
      onTouchMove={preventMultiTouchZoom}
    >
```
Замени на:
```jsx
  return (
    <div
      className="analog-timer-inner"
      onTouchStart={preventMultiTouchZoom}
      onTouchMove={preventMultiTouchZoom}
    >
```

- [ ] **Step 9: Commit**

```bash
git add src/features/timer/AnalogTimer.jsx
git commit -m "refactor(timer): remove compact mode, sync state to TimerContext"
```

---

## Task 4: Create GlobalTimer.jsx

**Files:**
- Create: `src/features/timer/GlobalTimer.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/features/timer/GlobalTimer.jsx
import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";

function formatTabTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, timeLeft, isRunning } = useTimer();
  const panelRef = useRef(null);

  const showCountdown = timeLeft > 0;
  const tabState = isRunning ? "running" : showCountdown ? "paused" : "idle";

  // Close on tap outside the panel+tab
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [isOpen, setIsOpen]);

  // Swipe-left on the panel to close
  const swipeRef = useRef(null);
  function handlePanelPointerDown(e) {
    swipeRef.current = { x: e.clientX };
  }
  function handlePanelPointerUp(e) {
    if (!swipeRef.current) return;
    const dx = e.clientX - swipeRef.current.x;
    swipeRef.current = null;
    if (dx < -40) setIsOpen(false);
  }

  return (
    <div
      ref={panelRef}
      className={`global-timer${isOpen ? " global-timer--open" : ""}`}
    >
      <div
        className="global-timer__panel"
        onPointerDown={handlePanelPointerDown}
        onPointerUp={handlePanelPointerUp}
      >
        <AnalogTimer rewardVideos={rewardVideos} />
      </div>

      <button
        className={`global-timer__tab global-timer__tab--${tabState}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Таймер"
      >
        {showCountdown ? (
          <span className="global-timer__tab-time">{formatTabTime(timeLeft)}</span>
        ) : (
          <span className="global-timer__tab-icon">⏱</span>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/timer/GlobalTimer.jsx
git commit -m "feat(timer): add GlobalTimer sliding panel with tab"
```

---

## Task 5: Add CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Добавить CSS для GlobalTimer**

В конец `src/styles.css` добавь:

```css
/* ── Global Timer ─────────────────────────────────────────── */

:root {
  --gt-panel-w: min(90vw, 88vh);
  --gt-tab-w: 32px;
}

.global-timer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: calc(var(--gt-panel-w) + var(--gt-tab-w));
  z-index: 200;
  display: flex;
  align-items: stretch;
  pointer-events: none;
  transform: translateX(calc(-1 * var(--gt-panel-w)));
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.global-timer--open {
  /* center the panel (clock) at 50vw; tab sticks out to the right */
  transform: translateX(calc(50vw - var(--gt-panel-w) / 2));
}

.global-timer__panel {
  flex: 0 0 var(--gt-panel-w);
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: radial-gradient(circle at top, rgba(74, 155, 143, 0.08), transparent 40%),
              linear-gradient(180deg, #fffdf9 0%, #f8f0e5 100%);
  box-shadow: 4px 0 32px rgba(0, 0, 0, 0.18);
  pointer-events: all;
}

.global-timer__tab {
  flex: 0 0 var(--gt-tab-w);
  height: 72px;
  align-self: center;
  background: #fffdf9;
  border: none;
  border-radius: 0 14px 14px 0;
  cursor: pointer;
  pointer-events: all;
  box-shadow: 3px 0 10px rgba(0, 0, 0, 0.13);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  padding: 0;
}

.global-timer__tab--idle {
  background: #fffdf9;
}

.global-timer__tab--running {
  background: #f5c842;
  animation: gt-breathe 2.2s ease-in-out infinite;
}

.global-timer__tab--running:hover {
  transform: translateX(4px);
  background: #f7d060;
}

.global-timer__tab--paused {
  background: #e8e0d4;
}

.global-timer__tab-icon {
  font-size: 17px;
  line-height: 1;
}

.global-timer__tab-time {
  font-size: 11px;
  font-family: ui-monospace, "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #3a2e22;
  white-space: nowrap;
  transform: rotate(-90deg);
  display: block;
}

.global-timer__tab--paused .global-timer__tab-time {
  color: #8a7a68;
}

@keyframes gt-breathe {
  0%, 100% { box-shadow: 3px 0 6px rgba(245, 200, 66, 0.3); }
  50%       { box-shadow: 3px 0 20px rgba(245, 200, 66, 0.75); }
}

/* ── analog-timer-inner (replaces analog-timer-overlay) ───── */

.analog-timer-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  touch-action: none;
  overscroll-behavior: contain;
  user-select: none;
  -webkit-user-select: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(timer): add GlobalTimer CSS, replace overlay with inner"
```

---

## Task 6: Update App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Заменить импорт AnalogTimer на GlobalTimer**

Найди строку 27:
```jsx
import AnalogTimer from "@/features/timer/AnalogTimer";
```
Замени на:
```jsx
import GlobalTimer from "@/features/timer/GlobalTimer";
import { useTimer } from "@/features/timer/TimerContext";
```

- [ ] **Step 2: Добавить useTimer и обновить useBackButtonGuard**

Сразу после строк с `useState` в теле `App()` (около строки 95) добавь:
```jsx
  const { isOpen: isTimerOpen, setIsOpen } = useTimer();
```

Найди строку 97:
```jsx
  const closeTimer = useCallback(() => setIsTimerOpen(false), []);
```
Замени на:
```jsx
  const closeTimer = useCallback(() => setIsOpen(false), [setIsOpen]);
```

Удали строку 95 (больше не нужна):
```jsx
  const [isTimerOpen, setIsTimerOpen] = useState(false);
```

- [ ] **Step 3: Обновить render — убрать AnalogTimer, добавить GlobalTimer**

Найди строку 211:
```jsx
        <Screen onOpenTimer={() => setIsTimerOpen(true)} />
```
Замени на:
```jsx
        <Screen />
```

Найди строку 213:
```jsx
      {isTimerOpen && <AnalogTimer rewardVideos={rewardVideos} onClose={closeTimer} />}
```
Замени на:
```jsx
      <GlobalTimer rewardVideos={rewardVideos} />
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(timer): use GlobalTimer in App, wire useTimer to back-button guard"
```

---

## Task 7: Clean up consumers

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:121,234`
- Modify: `src/topics/renderers/reading/index.jsx:7,306,340-346`

### HomeScreen.jsx

- [ ] **Step 1: Удалить onOpenTimer prop из сигнатуры**

Найди строку 121:
```jsx
export default function HomeScreen({ onOpenTimer }) {
```
Замени на:
```jsx
export default function HomeScreen() {
```

- [ ] **Step 2: Удалить кнопку таймера (строки 234-236)**

Найди и удали:
```jsx
          <button className="home-section-add" onClick={onOpenTimer} title="Таймер" aria-label="Таймер">
            ⏱
          </button>
```

### reading/index.jsx

- [ ] **Step 3: Удалить импорт AnalogTimer**

Найди строку 7:
```jsx
import AnalogTimer from "@/features/timer/AnalogTimer";
```
Удали эту строку.

- [ ] **Step 4: Удалить showTimer state и весь timer-код в InstructionTask**

Найди строку 306:
```jsx
  const [showTimer, setShowTimer] = useState(false);
```
Удали её.

Найди строку ~340:
```jsx
      {showTimer && <AnalogTimer noListenMode compact onClose={() => setShowTimer(false)} />}
```
Удали её.

Найди строки ~344-346:
```jsx
      {!showTimer && (
        <button className="instruction-timer-fab" onClick={() => setShowTimer(true)} title="Таймер">⏱</button>
      )}
```
Удали весь блок.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/HomeScreen.jsx src/topics/renderers/reading/index.jsx
git commit -m "refactor(timer): remove onOpenTimer prop and instruction FAB"
```

---

## Task 8: CSS cleanup

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Удалить .analog-timer-float* блоки**

В `src/styles.css` найди и удали CSS начиная со строки 10179 по первый следующий непустой класс. Удалить нужно следующие selector-блоки:
```
.analog-timer-float { ... }
.analog-timer-float svg { ... }
.analog-timer-float svg.running { ... }
.analog-timer-float__handle { ... }
.analog-timer-float__handle:active { ... }
.analog-timer-float__close { ... }
```

- [ ] **Step 2: Удалить .instruction-timer-fab и .instruction-timer-btn**

Найди и удали блоки:
```css
.instruction-timer-btn { ... }
.instruction-timer-btn:active { ... }
.instruction-timer-fab { ... }
```

- [ ] **Step 3: Удалить или закомментировать .analog-timer-overlay**

Найди строку 10164:
```css
.analog-timer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  ...
}
```
Удали этот блок целиком (стили теперь в `.analog-timer-inner` и `.global-timer__panel`).

Если `.analog-timer-overlay` встречается ещё раз (строка 15761) — удали и тот блок.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "refactor(timer): remove old float and instruction-fab CSS"
```

---

## Task 9: Manual verification

- [ ] **Step 1: Запустить dev-сервер**

```bash
npm run dev
```

- [ ] **Step 2: Проверить на главном экране**

Открой приложение → убедись что язычок `⏱` торчит слева. Тапни по нему → циферблат плавно выезжает по центру. Тапни снова или вне циферблата → уезжает обратно.

- [ ] **Step 3: Проверить запуск таймера**

Заведи таймер (протащи стрелку), запусти. Закрой язычком → на язычке должен появиться `02:34` с пульсацией. Hover → язычок сдвигается на 4px.

- [ ] **Step 4: Проверить экран инструкций (тема "Читаем. Готовим еду")**

Зайди в тему → убедись что FAB-кнопки `⏱` нет. Глобальный таймер доступен слева.

- [ ] **Step 5: Проверить завершение таймера**

Заведи 1 минуту, дождись или быстро отмотай → должен прозвонить колокол, показать экран успеха. После сброса язычок возвращается в idle состояние (иконка, без пульсации).

- [ ] **Step 6: Commit если всё OK**

```bash
git add -A
git commit -m "chore: verify global timer feature complete"
```
