# Chat Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить тип темы `chat_practice` — учебный чат для детей с РАС в стиле WhatsApp, со скриптованными диалогами и мягкой обратной связью.

**Architecture:** Новый тип темы загружается через существующий ZIP/IndexedDB pipeline (`meta.renderer === "chat_practice"`). При запуске открывается отдельный `ChatSessionScreen`, обходя стандартные экраны params/modes. Логика диалога инкапсулирована в хуке `useConversation`, изолированном от рендеринга — для будущего live-чата.

**Tech Stack:** React 19, Zustand, IndexedDB (через существующий `db.js`), Vitest, CSS custom properties.

## Global Constraints

- Все новые файлы: JSX/JS ESM с именами в camelCase (компоненты) или kebab-case (CSS)
- Алиас `@/` = `src/` (настроен в vite.config.js — использовать везде)
- Тесты: Vitest, синтаксис `describe`/`it`/`expect`, файл рядом с тестируемым
- `meta.renderer === "chat_practice"` — идентификатор типа темы (не `type`)
- Минимальный шрифт в чате: 18px; кнопки выбора: min-height 52px
- Цвета WhatsApp: header `#075e54`, bg `#ece5dd`, outgoing bubble `#dcf8c6`, accent `#25d366`
- Тестовая команда: `npx vitest run <path/to/file.test.js>`

---

### Task 1: `topicLoader.js` — поддержка `chat_practice`

**Files:**
- Modify: `src/topics/topicLoader.js`
- Test: `src/topics/topicLoader.test.js` (добавить тест-кейс)

**Interfaces:**
- Produces: `importTopic()` принимает ZIP с `meta.renderer === "chat_practice"` и `turns: [...]` без ошибок

- [ ] **Step 1: Написать падающий тест**

В `src/topics/topicLoader.test.js` добавить в конец файла:

```js
async function makeChatPracticeZip({ id = "morning_greeting", version = "1.0.0" } = {}) {
  const zip = new JSZip();
  const manifest = {
    meta: { id, version, language: "ru", renderer: "chat_practice", title: "Утреннее приветствие" },
    contact: { name: "Мама", avatar: "mom.png", color: "#25d366" },
    turns: [
      {
        id: "t1",
        from: "contact",
        text: "Привет!",
        anyIsCorrect: true,
        choices: [{ text: "Привет!" }],
        reactionOnSend: "Мама: Отлично!",
      },
    ],
  };
  zip.file("topic.json", JSON.stringify(manifest));
  zip.file("mom.png", "fake-png-data");
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("importTopic — chat_practice", () => {
  it("imports a chat_practice zip without errors", async () => {
    const db = await freshDb();
    const buf = await makeChatPracticeZip();
    const record = await importTopic(db, buf);
    expect(record.meta.renderer).toBe("chat_practice");
    expect(record.turns).toHaveLength(1);
    expect(record.contact.name).toBe("Мама");
  });

  it("throws when turns array is missing", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({
      meta: { id: "bad", version: "1.0.0", renderer: "chat_practice", title: "Bad" },
    }));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf)).rejects.toBeInstanceOf(TopicImportError);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```
npx vitest run src/topics/topicLoader.test.js
```

Ожидаем: FAIL — "Тема не содержит карточек" или аналогичная ошибка.

- [ ] **Step 3: Обновить `validateManifest` в `topicLoader.js`**

Найти строки с `isReading`, `isNarrative`, `isPhraseMatch` и добавить:

```js
function validateManifest(manifest, appVersion) {
  if (!manifest.meta?.id) throw new TopicImportError("Отсутствует meta.id");
  if (!manifest.meta?.version) throw new TopicImportError("Отсутствует meta.version");
  const isReading      = manifest.meta.renderer === "reading" || Array.isArray(manifest.texts);
  const isNarrative    = manifest.meta.renderer === "narrative";
  const isPhraseMatch  = manifest.meta.renderer === "phrase_match";
  const isChatPractice = manifest.meta.renderer === "chat_practice";

  if (isChatPractice) {
    if (!Array.isArray(manifest.turns) || manifest.turns.length === 0) {
      throw new TopicImportError("Тема chat_practice не содержит ходов (turns)");
    }
  } else if (isReading) {
    if (!Array.isArray(manifest.texts) || manifest.texts.length === 0) {
      throw new TopicImportError("Тема чтения не содержит текстов");
    }
  } else if (isPhraseMatch) {
    if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
      throw new TopicImportError("Тема phrase_match не содержит групп");
    }
  } else if (!isNarrative && (!Array.isArray(manifest.cards) || manifest.cards.length === 0)) {
    throw new TopicImportError("Тема не содержит карточек");
  }
  // ... остальной код validateManifest без изменений
```

- [ ] **Step 4: Запустить тесты — убедиться что проходят**

```
npx vitest run src/topics/topicLoader.test.js
```

Ожидаем: все тесты PASS.

- [ ] **Step 5: Commit**

```bash
git add src/topics/topicLoader.js src/topics/topicLoader.test.js
git commit -m "feat(chat-practice): support chat_practice renderer in topicLoader"
```

---

### Task 2: `useConversation.js` — логика диалога

**Files:**
- Create: `src/features/chat/useConversation.js`
- Create: `src/features/chat/useConversation.test.js`

**Interfaces:**
- Consumes: `script` = `{ turns: Turn[], contact: Contact }` (прямо из `topicRecord`)
- Produces:
  ```js
  {
    messages,        // Message[]
    currentChoices,  // Choice[] | null
    isTyping,        // boolean
    sendChoice,      // (choice: Choice) => void
    isComplete,      // boolean
    score,           // { correct: number, total: number }
    disabledChoices, // Set<string> — тексты кнопок, выбранных неверно
    showHint,        // boolean
    contact,         // Contact | null
  }
  ```

Типы:
```
Turn    = { id, from, text, anyIsCorrect?, choices, reactionOnSend?, reactionOnCorrect?, reactionOnWrong? }
Choice  = { text, correct?, next? }
Message = { id, from: "contact"|"child", text, timestamp: Date, isCorrect?: boolean }
Contact = { name, avatar, color }
```

- [ ] **Step 1: Написать тесты на чистую логику**

Создать `src/features/chat/useConversation.test.js`:

```js
import { describe, it, expect } from "vitest";
import { resolveNextTurnIndex, applyChoice } from "./useConversation";

const turns = [
  {
    id: "t1",
    from: "contact",
    text: "Привет!",
    anyIsCorrect: true,
    choices: [{ text: "Привет!" }, { text: "Добрый день!" }],
    reactionOnSend: "Мама: Отлично!",
  },
  {
    id: "t2",
    from: "contact",
    text: "Ты хочешь кушать?",
    choices: [
      { text: "Да", correct: true, next: "t3" },
      { text: "Нет", correct: true, next: "t3" },
      { text: "Не знаю", correct: false },
    ],
    reactionOnCorrect: "Мама: Хорошо!",
    reactionOnWrong: null,
  },
  {
    id: "t3",
    from: "contact",
    text: "Жди меня.",
    anyIsCorrect: true,
    choices: [{ text: "Ок" }],
  },
];

const initialState = {
  turnIndex: 0,
  score: { correct: 0, total: 0 },
  disabledChoices: new Set(),
  showHint: false,
};

describe("resolveNextTurnIndex", () => {
  it("returns next index when no next specified", () => {
    expect(resolveNextTurnIndex(turns, 0, undefined)).toBe(1);
  });

  it("resolves next by id", () => {
    expect(resolveNextTurnIndex(turns, 1, "t3")).toBe(2);
  });

  it("falls back to linear when id not found", () => {
    expect(resolveNextTurnIndex(turns, 0, "nonexistent")).toBe(1);
  });
});

describe("applyChoice — anyIsCorrect turn", () => {
  it("counts as correct for any choice", () => {
    const state = applyChoice(initialState, { text: "Привет!" }, turns);
    expect(state.score).toEqual({ correct: 1, total: 1 });
    expect(state.turnIndex).toBe(1);
    expect(state.showHint).toBe(false);
    expect(state.disabledChoices.size).toBe(0);
  });

  it("advances even with a 'wrong' choice if anyIsCorrect", () => {
    const state = applyChoice(initialState, { text: "Что угодно" }, turns);
    expect(state.score.correct).toBe(1);
  });
});

describe("applyChoice — correct/false turn", () => {
  const stateAtT2 = { ...initialState, turnIndex: 1 };

  it("correct choice advances and increments score", () => {
    const state = applyChoice(stateAtT2, { text: "Да", correct: true, next: "t3" }, turns);
    expect(state.score).toEqual({ correct: 1, total: 1 });
    expect(state.turnIndex).toBe(2);
    expect(state.isAdvancing).toBe(true);
  });

  it("wrong choice adds to disabledChoices and sets showHint", () => {
    const state = applyChoice(stateAtT2, { text: "Не знаю", correct: false }, turns);
    expect(state.score).toEqual({ correct: 0, total: 1 });
    expect(state.disabledChoices.has("Не знаю")).toBe(true);
    expect(state.showHint).toBe(true);
    expect(state.turnIndex).toBe(1);
    expect(state.isAdvancing).toBe(false);
  });

  it("correct after wrong clears hint and disabled choices", () => {
    const stateWithHint = {
      ...stateAtT2,
      disabledChoices: new Set(["Не знаю"]),
      showHint: true,
      score: { correct: 0, total: 1 },
    };
    const state = applyChoice(stateWithHint, { text: "Да", correct: true, next: "t3" }, turns);
    expect(state.showHint).toBe(false);
    expect(state.disabledChoices.size).toBe(0);
    expect(state.score).toEqual({ correct: 1, total: 2 });
  });
});

describe("applyChoice — session completion", () => {
  it("marks isComplete when last turn is answered", () => {
    const stateAtLast = { ...initialState, turnIndex: 2 };
    const state = applyChoice(stateAtLast, { text: "Ок" }, turns);
    expect(state.isComplete).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить — убедиться что падает**

```
npx vitest run src/features/chat/useConversation.test.js
```

Ожидаем: FAIL — модуль не найден.

- [ ] **Step 3: Создать `src/features/chat/useConversation.js`**

```js
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Pure logic ────────────────────────────────────────────────────────────────

export function resolveNextTurnIndex(turns, currentIndex, chosenNext) {
  if (chosenNext) {
    const idx = turns.findIndex((t) => t.id === chosenNext);
    return idx >= 0 ? idx : currentIndex + 1;
  }
  return currentIndex + 1;
}

export function applyChoice(state, choice, turns) {
  const currentTurn = turns[state.turnIndex];
  const isAnyCorrect = currentTurn.anyIsCorrect === true;
  const isCorrect = isAnyCorrect || choice.correct === true;

  if (!isCorrect) {
    return {
      ...state,
      score: { ...state.score, total: state.score.total + 1 },
      disabledChoices: new Set([...state.disabledChoices, choice.text]),
      showHint: true,
      isAdvancing: false,
    };
  }

  const nextIdx = resolveNextTurnIndex(turns, state.turnIndex, choice.next);
  return {
    ...state,
    score: { correct: state.score.correct + 1, total: state.score.total + 1 },
    disabledChoices: new Set(),
    showHint: false,
    turnIndex: nextIdx,
    isAdvancing: true,
    isComplete: nextIdx >= turns.length,
    pendingReaction: isAnyCorrect
      ? (currentTurn.reactionOnSend ?? null)
      : (currentTurn.reactionOnCorrect ?? null),
    lastChoiceText: choice.text,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useConversation(script) {
  const turns   = script?.turns ?? [];
  const contact = script?.contact ?? null;

  const [messages, setMessages]               = useState([]);
  const [turnIndex, setTurnIndex]             = useState(0);
  const [isTyping, setIsTyping]               = useState(true);
  const [isComplete, setIsComplete]           = useState(false);
  const [score, setScore]                     = useState({ correct: 0, total: 0 });
  const [disabledChoices, setDisabledChoices] = useState(new Set());
  const [showHint, setShowHint]               = useState(false);
  const [awaitingChoice, setAwaitingChoice]   = useState(false);
  const timerRef = useRef(null);

  const addMsg = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: new Date(), ...msg },
    ]);
  }, []);

  // Trigger contact typing whenever turn changes
  useEffect(() => {
    if (isComplete || turns.length === 0) return;
    const turn = turns[turnIndex];
    if (!turn) return;

    setIsTyping(true);
    setAwaitingChoice(false);
    timerRef.current = setTimeout(() => {
      addMsg({ from: "contact", text: turn.text });
      setIsTyping(false);
      setAwaitingChoice(true);
    }, 850);

    return () => clearTimeout(timerRef.current);
  }, [turnIndex, isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChoice = useCallback((choice) => {
    if (!awaitingChoice) return;
    const turn = turns[turnIndex];
    if (!turn) return;

    const logicState = {
      turnIndex,
      score,
      disabledChoices,
      showHint,
    };
    const next = applyChoice(logicState, choice, turns);

    setScore(next.score);

    if (!next.isAdvancing) {
      // Wrong answer
      setDisabledChoices(next.disabledChoices);
      setShowHint(true);
      return;
    }

    // Correct answer
    addMsg({ from: "child", text: next.lastChoiceText, isCorrect: true });
    setDisabledChoices(new Set());
    setShowHint(false);
    setAwaitingChoice(false);

    const afterReaction = () => {
      if (next.isComplete) {
        setIsComplete(true);
      } else {
        setTurnIndex(next.turnIndex);
      }
    };

    if (next.pendingReaction) {
      setIsTyping(true);
      timerRef.current = setTimeout(() => {
        addMsg({ from: "contact", text: next.pendingReaction });
        setIsTyping(false);
        timerRef.current = setTimeout(afterReaction, 500);
      }, 850);
    } else {
      timerRef.current = setTimeout(afterReaction, 400);
    }
  }, [awaitingChoice, turnIndex, score, disabledChoices, showHint, turns, addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const currentTurn    = turns[turnIndex] ?? null;
  const currentChoices = awaitingChoice ? (currentTurn?.choices ?? null) : null;

  return {
    messages,
    currentChoices,
    isTyping,
    sendChoice,
    isComplete,
    score,
    disabledChoices,
    showHint,
    contact,
  };
}
```

- [ ] **Step 4: Запустить тесты — убедиться что проходят**

```
npx vitest run src/features/chat/useConversation.test.js
```

Ожидаем: все тесты PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/useConversation.js src/features/chat/useConversation.test.js
git commit -m "feat(chat-practice): add useConversation hook with state machine"
```

---

### Task 3: UI компоненты и CSS

**Files:**
- Create: `src/features/chat/chat.css`
- Create: `src/shared/components/chat/ChatHeader.jsx`
- Create: `src/shared/components/chat/MessageBubble.jsx`
- Create: `src/shared/components/chat/TypingIndicator.jsx`
- Create: `src/shared/components/chat/ChoicePanel.jsx`
- Create: `src/shared/components/chat/ChatView.jsx`

**Interfaces:**
- Consumes (ChatView):
  ```js
  {
    contact,          // { name, avatar?, color } — avatar это имя файла, не URL
    topicId,          // string — для useTopicFile
    messages,         // Message[]
    isTyping,         // boolean
    currentChoices,   // Choice[] | null
    disabledChoices,  // Set<string>
    showHint,         // boolean
    onSendChoice,     // (choice: Choice) => void
  }
  ```
- Produces: полный экран чата (без шапки навигации, занимает всё пространство)

- [ ] **Step 1: Создать `src/features/chat/chat.css`**

```css
/* ─── Переменные WhatsApp-palette ─────────────────────────────────────────── */
.chat-screen {
  --chat-header-bg:      #075e54;
  --chat-header-text:    #ffffff;
  --chat-bg:             #ece5dd;
  --bubble-incoming-bg:  #ffffff;
  --bubble-outgoing-bg:  #dcf8c6;
  --chat-accent:         #25d366;
  --bubble-shadow:       0 1px 2px rgba(0, 0, 0, 0.13);
  --bubble-radius:       12px;

  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--chat-bg);
  overflow: hidden;
}

/* ─── Header ──────────────────────────────────────────────────────────────── */
.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--chat-header-bg);
  color: var(--chat-header-text);
  flex-shrink: 0;
}

.chat-header__back {
  background: none;
  border: none;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  padding: 4px 8px 4px 0;
  line-height: 1;
}

.chat-header__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--chat-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  overflow: hidden;
}

.chat-header__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-header__info { display: flex; flex-direction: column; }
.chat-header__name { font-weight: 600; font-size: 16px; }
.chat-header__status { font-size: 12px; opacity: 0.8; }

/* ─── Messages area ───────────────────────────────────────────────────────── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ─── Bubble ──────────────────────────────────────────────────────────────── */
.chat-bubble-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chat-bubble-row--outgoing {
  justify-content: flex-end;
}

.chat-bubble-row__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--chat-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  overflow: hidden;
}

.chat-bubble-row__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: var(--bubble-radius);
  box-shadow: var(--bubble-shadow);
  background: var(--bubble-incoming-bg);
  font-size: 18px;
  line-height: 1.4;
  color: #111;
  word-break: break-word;
}

.chat-bubble--incoming {
  border-top-left-radius: 0;
}

.chat-bubble--outgoing {
  background: var(--bubble-outgoing-bg);
  border-top-right-radius: 0;
}

.chat-bubble__time {
  font-size: 11px;
  color: #999;
  text-align: right;
  margin-top: 4px;
}

/* ─── Typing indicator ────────────────────────────────────────────────────── */
.chat-typing-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chat-typing-bubble {
  background: var(--bubble-incoming-bg);
  border-radius: var(--bubble-radius);
  border-top-left-radius: 0;
  box-shadow: var(--bubble-shadow);
  padding: 12px 16px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.chat-typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #aaa;
  animation: chat-dot-pulse 1.2s ease-in-out infinite;
}

.chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.chat-typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes chat-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1);   }
}

/* ─── Choice panel ────────────────────────────────────────────────────────── */
.chat-choice-panel {
  flex-shrink: 0;
  background: #e5e5e5;
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-choice-panel__hint {
  text-align: center;
  font-size: 13px;
  color: #888;
  margin-bottom: 2px;
  min-height: 18px;
}

.chat-choice-btn {
  width: 100%;
  min-height: 52px;
  padding: 12px 16px;
  font-size: 18px;
  font-weight: 500;
  color: #075e54;
  background: #fff;
  border: 2px solid var(--chat-accent);
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: background 0.12s, opacity 0.12s;
  -webkit-tap-highlight-color: transparent;
}

.chat-choice-btn:active {
  background: #e8f8e8;
}

.chat-choice-btn--flash-correct {
  border-color: var(--chat-accent);
  background: #e8f8e8;
}

.chat-choice-btn--hint {
  border-color: var(--chat-accent);
  box-shadow: 0 0 0 2px rgba(37, 211, 102, 0.25);
}

.chat-choice-btn--disabled {
  opacity: 0.35;
  pointer-events: none;
  border-color: #ccc;
  color: #aaa;
}
```

- [ ] **Step 2: Создать `src/shared/components/chat/ChatHeader.jsx`**

```jsx
import { useTopicFile } from "@/shared/hooks/useTopicFile";

export default function ChatHeader({ contact, topicId, onBack }) {
  const avatarUrl = useTopicFile(topicId, contact?.avatar);

  return (
    <div className="chat-header">
      {onBack && (
        <button className="chat-header__back" onClick={onBack} aria-label="Назад">
          ←
        </button>
      )}
      <div className="chat-header__avatar">
        {avatarUrl
          ? <img src={avatarUrl} alt="" />
          : <span>👤</span>
        }
      </div>
      <div className="chat-header__info">
        <span className="chat-header__name">{contact?.name ?? ""}</span>
        <span className="chat-header__status">в сети</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Создать `src/shared/components/chat/MessageBubble.jsx`**

```jsx
function formatTime(date) {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, contactAvatar }) {
  const isOutgoing = message.from === "child";
  return (
    <div className={`chat-bubble-row chat-bubble-row--${isOutgoing ? "outgoing" : "incoming"}`}>
      {!isOutgoing && (
        <div className="chat-bubble-row__avatar">
          {contactAvatar
            ? <img src={contactAvatar} alt="" />
            : <span style={{ fontSize: 14 }}>👤</span>
          }
        </div>
      )}
      <div className={`chat-bubble chat-bubble--${isOutgoing ? "outgoing" : "incoming"}`}>
        {message.text}
        <div className="chat-bubble__time">
          {formatTime(message.timestamp)}
          {isOutgoing && " ✓✓"}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Создать `src/shared/components/chat/TypingIndicator.jsx`**

```jsx
export default function TypingIndicator({ contactAvatar }) {
  return (
    <div className="chat-typing-row">
      <div className="chat-bubble-row__avatar">
        {contactAvatar
          ? <img src={contactAvatar} alt="" />
          : <span style={{ fontSize: 14 }}>👤</span>
        }
      </div>
      <div className="chat-typing-bubble">
        <div className="chat-typing-dot" />
        <div className="chat-typing-dot" />
        <div className="chat-typing-dot" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Создать `src/shared/components/chat/ChoicePanel.jsx`**

```jsx
export default function ChoicePanel({ choices, disabledChoices, showHint, onChoice }) {
  if (!choices) return null;

  const correctChoices = choices.filter((c) => c.correct === true);
  const hasCorrectFlag = choices.some((c) => "correct" in c);

  return (
    <div className="chat-choice-panel">
      <div className="chat-choice-panel__hint">
        {showHint ? "Попробуй ещё раз" : ""}
      </div>
      {choices.map((choice) => {
        const isDisabled = disabledChoices.has(choice.text);
        const isHinted   = showHint && hasCorrectFlag && choice.correct === true && !isDisabled;
        return (
          <button
            key={choice.text}
            className={[
              "chat-choice-btn",
              isDisabled ? "chat-choice-btn--disabled" : "",
              isHinted   ? "chat-choice-btn--hint"     : "",
            ].join(" ").trim()}
            onClick={() => !isDisabled && onChoice(choice)}
            disabled={isDisabled}
          >
            {choice.text}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Создать `src/shared/components/chat/ChatView.jsx`**

```jsx
import { useEffect, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChoicePanel from "./ChoicePanel";

export default function ChatView({
  contact,
  topicId,
  messages,
  isTyping,
  currentChoices,
  disabledChoices,
  showHint,
  onSendChoice,
  onBack,
}) {
  const avatarUrl  = useTopicFile(topicId, contact?.avatar);
  const bottomRef  = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  return (
    <div className="chat-screen">
      <ChatHeader contact={contact} topicId={topicId} onBack={onBack} />

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} contactAvatar={avatarUrl} />
        ))}
        {isTyping && <TypingIndicator contactAvatar={avatarUrl} />}
        <div ref={bottomRef} />
      </div>

      <ChoicePanel
        choices={currentChoices}
        disabledChoices={disabledChoices}
        showHint={showHint}
        onChoice={onSendChoice}
      />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/chat.css src/shared/components/chat/
git commit -m "feat(chat-practice): add chat UI components and WhatsApp-style CSS"
```

---

### Task 4: `ChatSummary.jsx` — экран завершения

**Files:**
- Create: `src/features/chat/ChatSummary.jsx`

**Interfaces:**
- Consumes: из `useAppStore` — `sessions` (последняя сессия), `appendSession` вызывается в `ChatSessionScreen`
- Produces: экран с похвалой + кнопками "Ещё раз" и "Домой"

- [ ] **Step 1: Создать `src/features/chat/ChatSummary.jsx`**

```jsx
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";

export default function ChatSummary({ score, onRepeat, onHome }) {
  const percent = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 100;

  const praise =
    percent === 100 ? "Отлично! Всё правильно!" :
    percent >= 80   ? "Молодец! Почти всё верно!" :
    percent >= 60   ? "Хорошо, но ещё потренируемся!" :
                      "Продолжай стараться!";

  return (
    <div className="screen screen-center" style={{ flexDirection: "column", gap: 24, padding: 24 }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{praise}</div>
      <div style={{ fontSize: 16, color: "#666" }}>
        Правильных ответов: {score.correct} из {score.total}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
        <Button fullWidth onClick={onRepeat}>
          Ещё раз
        </Button>
        <Button fullWidth variant="secondary" onClick={onHome}>
          На главную
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/chat/ChatSummary.jsx
git commit -m "feat(chat-practice): add ChatSummary completion screen"
```

---

### Task 5: `ChatSessionScreen.jsx` — оркестрация

**Files:**
- Create: `src/features/chat/ChatSessionScreen.jsx`

**Interfaces:**
- Consumes:
  - `useAppStore`: `activeTopicId`, `activeStudentId`, `topicRecords`, `appendSession`, `setScreen`
  - `useConversation(script)` — из Task 2
  - `ChatView` — из Task 3
  - `ChatSummary` — из Task 4
- Produces: монтируется как `screen === "chat_session"`; по завершении вызывает `appendSession` и показывает ChatSummary

- [ ] **Step 1: Создать `src/features/chat/ChatSessionScreen.jsx`**

```jsx
import { useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { useConversation } from "./useConversation";
import ChatView from "@/shared/components/chat/ChatView";
import ChatSummary from "./ChatSummary";
import "@/features/chat/chat.css";

export default function ChatSessionScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const appendSession   = useAppStore((s) => s.appendSession);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords    = useAppStore((s) => s.topicRecords);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const script      = topicRecord
    ? { turns: topicRecord.turns ?? [], contact: topicRecord.contact ?? null }
    : null;

  const {
    messages, currentChoices, isTyping, sendChoice,
    isComplete, score, disabledChoices, showHint, contact,
  } = useConversation(script);

  const [showingSummary, setShowingSummary] = useState(false);
  const [finalScore, setFinalScore]         = useState(null);

  // When conversation completes, save session and show summary
  if (isComplete && !showingSummary) {
    const percent = score.total > 0
      ? Math.round((score.correct / score.total) * 100)
      : 100;
    appendSession({
      id:              crypto.randomUUID(),
      studentId:       activeStudentId,
      topicId:         activeTopicId,
      conceptIds:      [],
      mistakes:        [],
      completedAt:     new Date().toISOString(),
      percentCorrect:  percent,
      chatScore:       { correct: score.correct, total: score.total },
    });
    setFinalScore(score);
    setShowingSummary(true);
  }

  const handleBack = useCallback(() => setScreen("home"), [setScreen]);

  if (showingSummary) {
    return (
      <ChatSummary
        score={finalScore}
        onRepeat={() => setScreen("chat_session")}
        onHome={() => setScreen("home")}
      />
    );
  }

  if (!script) {
    return <div className="screen-center">Тема не загружена</div>;
  }

  return (
    <ChatView
      contact={contact}
      topicId={activeTopicId}
      messages={messages}
      isTyping={isTyping}
      currentChoices={currentChoices}
      disabledChoices={disabledChoices}
      showHint={showHint}
      onSendChoice={sendChoice}
      onBack={handleBack}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/chat/ChatSessionScreen.jsx
git commit -m "feat(chat-practice): add ChatSessionScreen orchestrator"
```

---

### Task 6: Регистрация экрана и маршрутизация

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Produces: при нажатии "Начать занятие" с темой `chat_practice` → открывается `chat_session` экран напрямую, без params/modes

- [ ] **Step 1: Зарегистрировать экран в `src/App.jsx`**

Добавить import в начало файла (рядом с другими импортами экранов):

```js
import ChatSessionScreen from "@/features/chat/ChatSessionScreen";
```

Добавить в объект `SCREENS`:

```js
const SCREENS = {
  // ... existing screens ...
  chat_session: ChatSessionScreen,
};
```

- [ ] **Step 2: Обновить `HomeScreen.jsx` — детектировать chat_practice**

В начало файла добавить:

```js
const isChatPractice = topic?.meta?.renderer === "chat_practice";
```

Обновить функцию `startOrContinue`:

```js
function startOrContinue() {
  if (isChatPractice) { setScreen("chat_session"); return; }
  if (!isReading) { setScreen("params"); return; }
  if (!activeText) { setScreen("texts"); return; }
  setScreen("params");
}
```

Обновить `canStart`:

```js
const canStart = !!student && !!topic && (
  isChatPractice ? true :
  !isReading     ? !!mode :
  !activeText    ? false :
  activeText.kind === "instruction" ? true :
  !!mode
);
```

Обновить `conceptProgressSummary` — добавить ветку для `chat_practice`:

```js
function conceptProgressSummary(sessions, studentId, topicId, topicRecord) {
  if (!topicRecord) return { total: 0, mastered: 0 };
  if (topicRecord.meta?.renderer === "chat_practice") {
    const completed = sessions.filter(
      (s) => s.studentId === studentId && s.topicId === topicId
    ).length;
    return { total: topicRecord.turns?.length ?? 0, mastered: completed };
  }
  // ... existing branches unchanged ...
}
```

Обновить шаг 3 (режим) — для `chat_practice` шаг скрыт/недоступен. В JSX найти `JourneyStep` с `number="3"` и добавить условие:

```jsx
{!isChatPractice && (
  <JourneyStep
    state={s3}
    number="3"
    label={isReading ? "Текст и режим" : "Режим"}
    value={isReading ? readingStepValue : modeTitle || "Не выбран"}
    onClick={() => setScreen(isReading && activeText?.kind !== "instruction" && activeText ? "modes" : isReading ? "texts" : "modes")}
    avatar={/* ... без изменений ... */}
  />
)}
```

- [ ] **Step 3: Запустить существующие тесты — убедиться ничего не сломали**

```
npx vitest run
```

Ожидаем: все существующие тесты PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/features/home/HomeScreen.jsx
git commit -m "feat(chat-practice): register chat_session screen, route from HomeScreen"
```

---

### Task 7: Тестовый топик для ручной проверки

**Files:**
- Create: `content/topics/morning_greeting/topic.json`

**Goal:** Создать ZIP для ручного импорта и проверки всего флоу.

- [ ] **Step 1: Создать `content/topics/morning_greeting/topic.json`**

```json
{
  "meta": {
    "id": "morning_greeting",
    "version": "1.0.0",
    "language": "ru",
    "renderer": "chat_practice",
    "title": "Утреннее приветствие"
  },
  "contact": {
    "name": "Мама",
    "avatar": "mom.png",
    "color": "#25d366"
  },
  "turns": [
    {
      "id": "t1",
      "from": "contact",
      "text": "Доброе утро! ☀️",
      "anyIsCorrect": true,
      "choices": [
        { "text": "Доброе утро!" },
        { "text": "Привет, мам!" },
        { "text": "Доброе!" }
      ],
      "reactionOnSend": "Мама: Хорошо! ☀️"
    },
    {
      "id": "t2",
      "from": "contact",
      "text": "Ты хочешь кушать?",
      "choices": [
        { "text": "Да, хочу",   "correct": true,  "next": "t3" },
        { "text": "Нет",        "correct": true,  "next": "t3" },
        { "text": "Не знаю",   "correct": false              }
      ],
      "reactionOnCorrect": "Мама: Хорошо, иду готовить!"
    },
    {
      "id": "t3",
      "from": "contact",
      "text": "Жди меня. Скоро приду!",
      "anyIsCorrect": true,
      "choices": [
        { "text": "Ок" },
        { "text": "Хорошо" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Упаковать в ZIP**

В PowerShell или любым ZIP-архиватором:

```powershell
# Перейти в папку с топиком
cd content/topics/morning_greeting
# Создать ZIP (нужен любой PNG-файл как мок аватара, или реальный)
# Если нет реального mom.png — создать пустой файл:
# $null > mom.png
Compress-Archive -Path topic.json, mom.png -DestinationPath ../morning_greeting.zip -Force
```

- [ ] **Step 3: Ручная проверка флоу**

1. Запустить `npm run dev`
2. Открыть http://localhost:8080
3. Перейти в "Темы" → кнопка импорт (скрепка) → загрузить `morning_greeting.zip`
4. На главной выбрать ученика → выбрать тему "Утреннее приветствие"
5. Нажать "Начать занятие" → должен открыться чат (не экран params)
6. Проверить: шапка с именем "Мама", typing indicator, пузырьки, кнопки выбора
7. Нажать неверный ответ ("Не знаю" на 2-м ходу) → кнопка становится серой, подсказка "Попробуй ещё раз", верные кнопки подсвечиваются
8. Завершить диалог → экран ChatSummary с результатом

- [ ] **Step 4: Commit**

```bash
git add content/topics/morning_greeting/topic.json
git commit -m "feat(chat-practice): add sample morning_greeting topic for testing"
```

---

## Self-Review

**Spec coverage:**
- ✅ `chat_practice` тип темы в ZIP
- ✅ `useConversation` абстракция для будущего live-чата
- ✅ WhatsApp-style визуал (#075e54, #ece5dd, #dcf8c6)
- ✅ Шрифт ≥18px, кнопки ≥52px
- ✅ `anyIsCorrect` и `correct: true/false` схемы
- ✅ Ветвление через `next`
- ✅ Мягкая обратная связь: "Попробуй ещё раз", без красных X
- ✅ Typing indicator анимация
- ✅ `appendSession` для аналитики
- ✅ ChatSummary с похвалой и результатом
- ✅ Кнопка "Назад" из чата

**Placeholder scan:** нет TBD/TODO — всё реализовано с кодом.

**Type consistency:**
- `sendChoice(choice)` — в `useConversation`, `ChatView`, `ChoicePanel`, `ChatSessionScreen` — одинаковая сигнатура
- `messages: Message[]` — одинаковая форма во всех компонентах
- `disabledChoices: Set<string>` — передаётся из `useConversation` → `ChatView` → `ChoicePanel`
- `score: { correct, total }` — одинакова в `useConversation`, `ChatSessionScreen`, `ChatSummary`
