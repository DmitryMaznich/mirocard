# Tap-to-Advance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить app-level настройки темпа продолжения: «следующая карта по тапу» (дефолт) или авто-переход через N секунд.

**Architecture:** Два поля (`tapToAdvance`, `autoAdvanceDelay`) добавляются в Zustand-настройки и персистятся в IndexedDB. `useSessionEngine` читает их и либо ждёт тапа (статус `answer_correct` без таймера), либо запускает таймер. `SessionScreen` делает feedback-оверлей кликабельным. `SettingsScreen` рендерит UI для этих полей.

**Tech Stack:** React, Zustand, IndexedDB (kv), CSS-переменные проекта.

---

## Файловая карта

| Файл | Действие | Что меняется |
|------|----------|--------------|
| `src/core/store.js` | Modify | добавить `tapToAdvance: true`, `autoAdvanceDelay: 3` в дефолтные settings |
| `src/core/bootstrap.js` | Modify | мёрджить сохранённые settings на дефолты (не заменять целиком) |
| `src/features/session/useSessionEngine.js` | Modify | читать настройки; `onCorrect` — ждать тапа или таймер; `onIncorrect` — всегда фиксированный короткий таймер |
| `src/features/session/SessionScreen.jsx` | Modify | feedback-оверлей кликабелен при `tapToAdvance=true` + текст-подсказка |
| `src/features/settings/SettingsScreen.jsx` | Modify | секция «Темп продолжения» с чекбоксом и степпером |

---

### Task 1: Дефолтные поля в сторе + мёрдж при загрузке

> Без этого новые поля не появятся у существующих пользователей с уже сохранёнными settings.

**Files:**
- Modify: `src/core/store.js:16-23`
- Modify: `src/core/bootstrap.js:54`

- [ ] **Step 1.1: Добавить поля в дефолтные settings в store.js**

Заменить блок settings (строки 16-23):

```js
settings: {
  uiLanguage: "ru",
  cardLanguage: "ru",
  adultPinHash: null,
  pushAppUpdates: true,
  pushTopicUpdates: true,
  pushReminders: false,
  tapToAdvance: true,
  autoAdvanceDelay: 3,
},
```

- [ ] **Step 1.2: Исправить мёрдж settings в bootstrap.js**

Строка 54 (`settings: bootstrap.settings ?? state.settings`) → заменить на:

```js
settings: { ...state.settings, ...(bootstrap.settings ?? {}) },
```

Это гарантирует, что новые поля из store-дефолтов появятся у существующих пользователей, у которых в IndexedDB нет этих ключей.

- [ ] **Step 1.3: Коммит**

```bash
git add src/core/store.js src/core/bootstrap.js
git commit -m "feat(settings): add tapToAdvance and autoAdvanceDelay defaults"
```

---

### Task 2: Логика в useSessionEngine

**Files:**
- Modify: `src/features/session/useSessionEngine.js:1-168`

- [ ] **Step 2.1: Добавить чтение настроек и изменить onCorrect / onIncorrect**

Полный новый файл `useSessionEngine.js` (заменить целиком):

```js
import { useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { createSessionState, handleAnswer, handleAdvance, handleQualityAnswer, computeSessionRecord } from "./sessionEngine";

const INCORRECT_FEEDBACK_MS = 1500;

export function useSessionEngine() {
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const activeTextId      = useAppStore((s) => s.activeTextId);
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);
  const appendSession     = useAppStore((s) => s.appendSession);
  const tapToAdvance      = useAppStore((s) => s.settings.tapToAdvance ?? true);
  const autoAdvanceDelay  = useAppStore((s) => s.settings.autoAdvanceDelay ?? 3);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode = topicRecord?.modes?.find((m) => m.id === activeModeId);

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
  const isReading = topicRecord?.meta.renderer === "reading";
  const selectedConceptIds = isReading
    ? (activeTextId ? [activeTextId] : [])
    : link.selectedConceptIds
      ?? topicRecord?.cards.filter((c) => c.primary).map((c) => c.conceptId)
      ?? [];
  const sessionParams = link.params ?? {};

  const [sessionState, setSessionState] = useState(() => {
    if (!topicRecord || !mode) return null;

    const renderer = topicRecord.meta.renderer;
    let tasks;

    if (renderer === "reading") {
      const generateTasks = ENGINE_REGISTRY["reading"];
      tasks = generateTasks
        ? generateTasks(mode, topicRecord, activeTextId, sessionParams)
        : [];
    } else if (renderer === "flashcards") {
      const allConcepts = deriveConcepts(topicRecord.cards);
      const concepts = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
      const generateTasks = ENGINE_REGISTRY["flashcards"];
      tasks = generateTasks(mode.type, concepts, topicRecord.cards, sessionParams);
    } else {
      const generateTasks = ENGINE_REGISTRY[renderer];
      const sessionSize = topicRecord.meta.sessionConfig?.maxSize ?? 15;
      const selectedCards = topicRecord.cards.filter((c) => selectedConceptIds.includes(c.conceptId));
      tasks = generateTasks
        ? generateTasks(mode, selectedCards.length ? selectedCards : topicRecord.cards, sessionSize, sessionParams)
        : [];
    }

    const baseState = createSessionState(
      tasks, mode, activeStudentId, activeTopicId,
      topicRecord.meta.version, selectedConceptIds, isReading ? activeTextId : null
    );
    if (mode.type === "assemble_text") {
      const totalWords = tasks.reduce((sum, t) => sum + (t.tokenCount ?? 0), 0);
      return { ...baseState, totalWords };
    }
    return baseState;
  });

  const [completedRecord, setCompletedRecord] = useState(null);

  async function finishSession(state) {
    const record = computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version);
    const db = await getDb();
    await kv.set(db, "lastContext", {
      studentId: activeStudentId,
      topicId:   activeTopicId,
      textId:    activeTextId ?? null,
      modeId:    activeModeId,
    });
    const existing = (await kv.get(db, "sessions")) ?? [];
    const updated = [...existing, record].slice(-200);
    await kv.set(db, "sessions", updated);
    appendSession(record);
    setCompletedRecord(record);
    pushOp("session.append", { ...record, mode: record.modeId });
  }

  const onCorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => {
      const next = handleAnswer(s, true, conceptId, cardId);
      if (next.status === "completed") finishSession(next);
      return next;
    });

    if (!tapToAdvance) {
      setTimeout(() => {
        setSessionState((s) => {
          if (s.status !== "answer_correct") return s;
          if (s.mode.type === "compare_first_number") return s;
          const advanced = handleAdvance(s);
          if (advanced.status === "completed") finishSession(advanced);
          return advanced;
        });
      }, autoAdvanceDelay * 1000);
    }
  }, [tapToAdvance, autoAdvanceDelay]);

  const onIncorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => handleAnswer(s, false, conceptId, cardId));
    setTimeout(() => {
      setSessionState((s) => {
        if (s.status !== "answer_incorrect") return s;
        if (s.mode.type === "compare_first_number") return s;
        if (s.tasks[s.taskIndex]?.type === "choose_all") {
          const advanced = handleAdvance(s);
          if (advanced.status === "completed") finishSession(advanced);
          return advanced;
        }
        return { ...s, status: "task_active", taskRetry: (s.taskRetry ?? 0) + 1 };
      });
    }, INCORRECT_FEEDBACK_MS);
  }, []);

  const onMistake = useCallback((conceptId, cardId) => {
    setSessionState((s) => {
      if (!s || s.mode.evaluation === "none") return s;
      return {
        ...s,
        incorrectCount: s.incorrectCount + 1,
        mistakes: conceptId
          ? [...s.mistakes, { conceptId, cardId }]
          : s.mistakes,
      };
    });
  }, []);

  const onAdvance = useCallback(() => {
    setSessionState((s) => {
      const next = handleAdvance(s);
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const onQualityAnswer = useCallback((quality, conceptId, cardId) => {
    setSessionState((s) => {
      const next = handleQualityAnswer(s, quality, conceptId, cardId);
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const currentTask = sessionState?.tasks[sessionState.taskIndex] ?? null;

  return {
    sessionState,
    currentTask,
    mode,
    topicRecord,
    sessionParams,
    completedRecord,
    onCorrect,
    onIncorrect,
    onMistake,
    onAdvance,
    onQualityAnswer,
  };
}
```

- [ ] **Step 2.2: Коммит**

```bash
git add src/features/session/useSessionEngine.js
git commit -m "feat(session): tap-to-advance or auto-timer after correct answer"
```

---

### Task 3: Feedback-оверлей кликабелен в SessionScreen

**Files:**
- Modify: `src/features/session/SessionScreen.jsx:1-104`

- [ ] **Step 3.1: Импортировать настройки и сделать оверлей кликабельным**

Заменить файл целиком:

```jsx
import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";

export default function SessionScreen() {
  const setScreen      = useAppStore((s) => s.setScreen);
  const tapToAdvance   = useAppStore((s) => s.settings.tapToAdvance ?? true);

  const {
    sessionState, currentTask, mode, topicRecord, sessionParams,
    completedRecord, onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();

  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && mode?.type === "read_text";
    setScreen(skipSummary ? "modes" : "summary");
  }, [completedRecord, mode?.type, setScreen, topicRecord?.meta.renderer]);

  function handleCorrect(conceptId, cardId) {
    playFeedback("correct");
    onCorrect(conceptId, cardId);
  }

  function handleIncorrect(conceptId, cardId) {
    playFeedback("incorrect");
    onIncorrect(conceptId, cardId);
  }

  function handleMistake(conceptId, cardId) {
    playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }

  if (!sessionState || !topicRecord || !mode) {
    return (
      <div className="session-screen">
        <div className="screen-center">Нет данных для сессии</div>
      </div>
    );
  }

  const Renderer = RENDERER_REGISTRY[topicRecord.meta.renderer];
  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState;
  const total = tasks.length;

  const isCorrectFeedback   = status === "answer_correct";
  const isIncorrectFeedback = status === "answer_incorrect";

  const feedbackClass =
    isCorrectFeedback   ? "session-feedback session-feedback--correct"
  : isIncorrectFeedback ? "session-feedback session-feedback--incorrect"
  : "";

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <ProgressBar value={taskIndex} max={total} className="session-progress" />
        <div className="session-counter">
          {taskIndex + 1} / {total}
          {mode.evaluation === "auto" && (
            <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
          )}
        </div>
        <button
          className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
          onClick={toggleSound}
          aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          <span className="session-audio-speaker-icon">
            {soundEnabled ? "🔊" : "🔇"}
          </span>
        </button>
        <button className="session-finish-btn" onClick={() => setScreen("home")}>✕</button>
      </div>

      {feedbackClass && (
        <div
          className={`${feedbackClass}${isCorrectFeedback && tapToAdvance ? " session-feedback--tappable" : ""}`}
          onClick={isCorrectFeedback && tapToAdvance ? onAdvance : undefined}
        >
          {isCorrectFeedback ? "Правильно!" : "Попробуем ещё раз…"}
          {isCorrectFeedback && tapToAdvance && (
            <div className="session-feedback__tap-hint">Нажмите, чтобы продолжить</div>
          )}
        </div>
      )}

      {Renderer && currentTask ? (
        <Renderer
          key={`${taskIndex}_${sessionState.taskRetry ?? 0}`}
          task={currentTask}
          mode={mode}
          sessionStatus={status}
          topicId={topicRecord.meta.id}
          sessionParams={sessionParams}
          soundEnabled={soundEnabled}
          playTopicFile={playTopicFile}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
          onMistake={handleMistake}
          onAdvance={onAdvance}
          onQualityAnswer={onQualityAnswer}
        />
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.2: Добавить CSS для tappable-оверлея**

Найти файл со стилями сессии (скорее всего `src/features/session/SessionScreen.css` или в общем `index.css`). Добавить:

```css
.session-feedback--tappable {
  cursor: pointer;
  user-select: none;
}

.session-feedback__tap-hint {
  font-size: 0.75em;
  opacity: 0.7;
  margin-top: 6px;
}
```

- [ ] **Step 3.3: Коммит**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat(session): tappable correct-feedback overlay when tap-to-advance is on"
```

---

### Task 4: UI в SettingsScreen

**Files:**
- Modify: `src/features/settings/SettingsScreen.jsx:1-107`

- [ ] **Step 4.1: Добавить секцию настроек темпа**

Заменить файл целиком:

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

function fakeSession(pct, studentId, topicId) {
  const total = 10;
  const correct = Math.round(total * pct / 100);
  return {
    id: "dev_" + Date.now(),
    studentId: studentId ?? "dev",
    topicId:   topicId   ?? "dev",
    topicVersion: "1.0.0",
    modeId:    "yes_no",
    conceptIds: [],
    startedAt:   new Date().toISOString(),
    completedAt: new Date().toISOString(),
    correctCount:   correct,
    incorrectCount: total - correct,
    percentCorrect: pct,
    mistakes: [],
  };
}

export default function SettingsScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const account          = useAppStore((s) => s.account);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const logout           = useAppStore((s) => s.logout);
  const appendSession    = useAppStore((s) => s.appendSession);
  const activeStudentId  = useAppStore((s) => s.activeStudentId);
  const activeTopicId    = useAppStore((s) => s.activeTopicId);
  const settings         = useAppStore((s) => s.settings);
  const patchSettings    = useAppStore((s) => s.patchSettings);

  const tapToAdvance     = settings.tapToAdvance ?? true;
  const autoAdvanceDelay = settings.autoAdvanceDelay ?? 3;

  async function handlePatchSettings(patch) {
    patchSettings(patch);
    const db = await getDb();
    await kv.set(db, "settings", { ...settings, ...patch });
  }

  function testSummary(pct) {
    appendSession(fakeSession(pct, activeStudentId, activeTopicId));
    setScreen("summary");
  }

  const [confirmLogout, setConfirmLogout] = useState(false);

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {}
    const db = await getDb();
    await kv.del(db, "token");
    await kv.del(db, "account");
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Настройки</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Аккаунт</div>
          <div className="settings-row">
            <div className="settings-row__label">Email</div>
            <div className="settings-row__value">{account?.email ?? "—"}</div>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">Имя</div>
            <div className="settings-row__value">{account?.displayName ?? "—"}</div>
          </div>
        </div>

        <div className="settings-section">
          {!confirmLogout ? (
            <button className="settings-danger-btn" onClick={() => setConfirmLogout(true)}>
              Выйти из аккаунта
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, padding: 12 }}>
              <Button variant="secondary" onClick={() => setConfirmLogout(false)}>Отмена</Button>
              <Button variant="danger" onClick={handleLogout}>Выйти</Button>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Темп продолжения</div>
          <label className="settings-row" style={{ cursor: "pointer", gap: 10 }}>
            <input
              type="checkbox"
              checked={tapToAdvance}
              onChange={(e) => handlePatchSettings({ tapToAdvance: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary, #5b8def)", flexShrink: 0 }}
            />
            <span className="settings-row__label">Следующая карта по тапу</span>
          </label>
          <div className="settings-row" style={{ opacity: tapToAdvance ? 0.4 : 1, pointerEvents: tapToAdvance ? "none" : "auto" }}>
            <div className="settings-row__label">Задержка (сек)</div>
            <div className="param-stepper">
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay <= 1}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay - 1 })}
              >−</button>
              <span className="stepper-value">{autoAdvanceDelay}</span>
              <button
                className="stepper-btn"
                disabled={autoAdvanceDelay >= 10}
                onClick={() => handlePatchSettings({ autoAdvanceDelay: autoAdvanceDelay + 1 })}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section" style={{ borderTop: "1px dashed #ddd", marginTop: 8 }}>
        <div className="settings-section-title" style={{ color: "#bbb" }}>Dev · тест экрана завершения</div>
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", flexWrap: "wrap" }}>
          {[100, 90, 75, 50, 30].map((pct) => (
            <button
              key={pct}
              onClick={() => testSummary(pct)}
              style={{
                padding: "6px 14px", borderRadius: 10, border: "1px solid #ddd",
                background: "#f5f5f5", fontSize: 14, cursor: "pointer",
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Коммит**

```bash
git add src/features/settings/SettingsScreen.jsx
git commit -m "feat(settings): add pace settings UI (tap-to-advance + delay stepper)"
```

---

### Task 5: CSS стили для новых элементов

- [ ] **Step 5.1: Найти CSS-файл сессии**

```bash
find src -name "*.css" | xargs grep -l "session-feedback" 2>/dev/null
```

- [ ] **Step 5.2: Добавить стили**

В найденный файл добавить после существующих `.session-feedback` правил:

```css
.session-feedback--tappable {
  cursor: pointer;
  user-select: none;
}

.session-feedback__tap-hint {
  font-size: 0.75em;
  opacity: 0.7;
  margin-top: 6px;
}
```

- [ ] **Step 5.3: Проверить наличие `stepper-btn` и `stepper-value` в CSS**

```bash
grep -r "stepper-btn\|stepper-value" src --include="*.css"
```

Если классов нет — добавить (они нужны для степпера в SettingsScreen):

```css
.param-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper-value {
  min-width: 28px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
}
```

- [ ] **Step 5.4: Коммит**

```bash
git add src
git commit -m "style(session,settings): tap-hint and stepper styles"
```

---

### Task 6: Ручная проверка

- [ ] **Step 6.1:** Запустить дев-сервер и открыть приложение.
- [ ] **Step 6.2:** Перейти в Настройки — убедиться что секция «Темп продолжения» отображается, чекбокс включён по умолчанию, степпер задизейблен.
- [ ] **Step 6.3:** Снять чекбокс — убедиться что степпер активируется. Поменять значение на 2.
- [ ] **Step 6.4:** Запустить любой интерактивный режим (да/нет, найди, сравнение). Ответить правильно — карточка должна перейти автоматически через 2 секунды.
- [ ] **Step 6.5:** Включить чекбокс обратно. Ответить правильно — оверлей «Правильно!» должен остаться с подсказкой «Нажмите, чтобы продолжить». Тапнуть — перейти к следующей.
- [ ] **Step 6.6:** Ответить неправильно в обоих режимах — убедиться что карточка сбрасывается автоматически через ~1.5 сек.
- [ ] **Step 6.7:** Перезагрузить страницу — убедиться что настройки сохранились.
