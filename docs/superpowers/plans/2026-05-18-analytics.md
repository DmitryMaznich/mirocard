# Analytics: Child Mastery Hypothesis System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log per-card tap events during flashcard sessions and surface an AI-generated mastery hypothesis with a per-card status dashboard.

**Architecture:** Additive — new `card_events` JSON column on `sessions` table carries per-card event data collected by a `useCardEventLogger` hook wired into the existing session lifecycle. A new backend endpoint fetches all sessions for a topic, calls Claude with a versioned prompt, caches the result, and returns it to a new `AnalyticsScreen`. Entry point is a chart-icon button added to `InstalledTopicItem` in `TopicLibraryScreen`.

**Tech Stack:** React 19, Zustand, Node.js SQLite (`node:sqlite`), Anthropic SDK (`@anthropic-ai/sdk`), existing `api` client (`src/core/api.js`).

---

## File Map

**Create:**
- `src/features/analytics/computeGuessingScore.js` — pure function, no deps
- `src/features/analytics/useCardEventLogger.js` — React hook, collects tap events
- `src/features/analytics/AnalyticsScreen.jsx` — report UI
- `backend/prompts/topic-analysis-v1.md` — versioned Claude prompt
- `backend/lib/analysis.mjs` — fetch sessions → call Claude → cache

**Modify:**
- `backend/lib/db.mjs:67–83` — add `card_events` column + `analysis_cache` table
- `backend/server.mjs:360–368` — update `appendSession` handler + add analysis route
- `src/features/session/sessionEngine.js:58–93` — include `cardEvents` in `computeSessionRecord`
- `src/features/session/useSessionEngine.js:118–149` — wire logger into `finishSession`
- `src/topics/renderers/flashcards/index.jsx:157–202` — pass `onCardShown`/`onTap`/`onQuality` callbacks
- `src/features/topics/TopicLibraryScreen.jsx:19–39` — add analytics button to `InstalledTopicItem`

---

## Task 1: DB Schema

**Files:**
- Modify: `backend/lib/db.mjs`

- [ ] **Step 1: Add `card_events` column to sessions table**

In `backend/lib/db.mjs`, find the `CREATE TABLE IF NOT EXISTS sessions` block (lines 67–81) and add `card_events TEXT DEFAULT '[]'` as the last column before the closing paren:

```javascript
// backend/lib/db.mjs — sessions table, add after line 78 (percent_correct line)
  mistakes         TEXT DEFAULT '[]',
  assessments      TEXT,
  card_events      TEXT DEFAULT '[]',   // ← add this line
  created_at       TEXT NOT NULL
```

- [ ] **Step 2: Create `analysis_cache` table**

After the sessions table block, add:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_cache (
    id              INTEGER PRIMARY KEY,
    student_id      TEXT NOT NULL,
    topic_id        TEXT NOT NULL,
    prompt_version  TEXT NOT NULL,
    generated_at    INTEGER NOT NULL,
    result_json     TEXT NOT NULL,
    UNIQUE(student_id, topic_id)
  )
`);
```

- [ ] **Step 3: Verify DB initialises without error**

```bash
node -e "import('./backend/lib/db.mjs').then(m => console.log('ok'))"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/lib/db.mjs
git commit -m "feat(analytics): add card_events column and analysis_cache table"
```

---

## Task 2: `computeGuessingScore` Pure Function

**Files:**
- Create: `src/features/analytics/computeGuessingScore.js`

- [ ] **Step 1: Create the file with the formula**

```javascript
// src/features/analytics/computeGuessingScore.js
const RT_FAST = 1500;
const RT_SLOW = 8000;

/**
 * Returns 0.0 (mastered) … 1.0 (guessing) based on attempt count and reaction time.
 * k=1, t=800ms → 0.00   k=1, t=3000ms → 0.08
 * k=2, t=5000ms → 0.51  k=3, t=8000ms → 0.78
 */
export function computeGuessingScore(attemptCount, firstCorrectMs) {
  const k = Math.max(1, attemptCount);
  const t = Math.max(0, firstCorrectMs);
  const attemptSignal = 1 - 1 / k;
  const timeSignal = Math.max(0, Math.min(1, (t - RT_FAST) / (RT_SLOW - RT_FAST)));
  return Math.round((0.65 * attemptSignal + 0.35 * timeSignal) * 100) / 100;
}

/** Maps question_answer quality value to a guessing_score equivalent. */
export function qualityToGuessingScore(quality) {
  return { easy: 0.0, correct: 0.15, prompted: 0.65, fail: 0.90 }[quality] ?? 0.5;
}
```

- [ ] **Step 2: Verify by running quick sanity check**

```bash
node -e "
import { computeGuessingScore } from './src/features/analytics/computeGuessingScore.js';
console.assert(computeGuessingScore(1, 800) === 0, 'k=1,t=800 should be 0');
console.assert(computeGuessingScore(1, 3000) === 0.08, 'k=1,t=3000 should be 0.08');
console.assert(computeGuessingScore(3, 8000) === 0.78, 'k=3,t=8000 should be 0.78');
console.log('all assertions passed');
"
```

Expected: `all assertions passed`

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/computeGuessingScore.js
git commit -m "feat(analytics): add computeGuessingScore pure function"
```

---

## Task 3: `useCardEventLogger` Hook

**Files:**
- Create: `src/features/analytics/useCardEventLogger.js`

- [ ] **Step 1: Create the hook**

```javascript
// src/features/analytics/useCardEventLogger.js
import { useCallback, useRef } from "react";
import { computeGuessingScore, qualityToGuessingScore } from "./computeGuessingScore.js";

export function useCardEventLogger() {
  const eventsRef = useRef([]);
  const currentRef = useRef(null); // { cardId, conceptId, shownAt, taps[] }

  const onCardShown = useCallback((cardId, conceptId) => {
    currentRef.current = { cardId, conceptId, shownAt: Date.now(), taps: [] };
  }, []);

  const onTap = useCallback((optionId, isCorrect) => {
    if (!currentRef.current) return;
    const ms = Date.now() - currentRef.current.shownAt;
    currentRef.current.taps.push({ optionId, isCorrect, ms });
    if (isCorrect) {
      const { cardId, conceptId, shownAt, taps } = currentRef.current;
      const firstCorrectMs = ms;
      const attemptCount = taps.length;
      eventsRef.current.push({
        cardId,
        conceptId,
        shownAt,
        taps,
        firstCorrectMs,
        attemptCount,
        guessingScore: computeGuessingScore(attemptCount, firstCorrectMs),
      });
      currentRef.current = null;
    }
  }, []);

  const onQuality = useCallback((quality, cardId, conceptId) => {
    const shownAt = currentRef.current?.shownAt ?? Date.now();
    const firstCorrectMs = Date.now() - shownAt;
    eventsRef.current.push({
      cardId,
      conceptId,
      shownAt,
      quality,
      firstCorrectMs,
      attemptCount: 1,
      guessingScore: qualityToGuessingScore(quality),
    });
    currentRef.current = null;
  }, []);

  const getCardEvents = useCallback(() => [...eventsRef.current], []);
  const resetCardEvents = useCallback(() => { eventsRef.current = []; }, []);

  return { onCardShown, onTap, onQuality, getCardEvents, resetCardEvents };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/analytics/useCardEventLogger.js
git commit -m "feat(analytics): add useCardEventLogger hook"
```

---

## Task 4: Instrument Flashcard Renderers

**Files:**
- Modify: `src/topics/renderers/flashcards/index.jsx`

The four task components receive props. We add three optional callbacks: `onCardShown`, `onTap`, `onQuality`. Renderers call them if provided (backwards-compatible).

- [ ] **Step 1: Instrument `find_n` (FindNTask)**

Find the `FindNTask` component (lines ~157–178). Add `onCardShown` call in a `useEffect` on mount, and `onTap` call inside `handleOption`:

```jsx
// FindNTask — add onCardShown, onTap to destructured props
function FindNTask({ task, status, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task.card?.id, task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    if (status !== "task_active") return;
    const isCorrect = option.id === task.card?.id || option.conceptId === task.conceptId;
    onTap?.(option.id ?? option.conceptId, isCorrect);
    if (isCorrect) onCorrect(task.conceptId, task.card?.id);
    else           onIncorrect(task.conceptId, task.card?.id);
  }
  // ... rest of component unchanged
}
```

- [ ] **Step 2: Instrument `yes_no` (YesNoTask)**

Find `YesNoTask` (lines ~126–143). Add `onCardShown` on mount, `onTap` with synthetic option ids `"yes"` / `"no"`:

```jsx
function YesNoTask({ task, status, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task.card?.id, task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(answeredYes) {
    if (status !== "task_active") return;
    const isCorrect = answeredYes === task.correctAnswer;
    onTap?.(answeredYes ? "yes" : "no", isCorrect);
    if (isCorrect) onCorrect(task.conceptId, task.card?.id);
    else           onIncorrect(task.conceptId, task.card?.id);
  }
  // ... rest unchanged
}
```

- [ ] **Step 3: Instrument `choose_word_by_picture` (ChooseWordTask)**

Find `ChooseWordTask` (lines ~180–202). Same pattern:

```jsx
function ChooseWordTask({ task, status, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task.card?.id, task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    if (status !== "task_active") return;
    const isCorrect = option.conceptId === task.conceptId;
    onTap?.(option.conceptId, isCorrect);
    if (isCorrect) onCorrect(task.conceptId, task.card?.id);
    else           onIncorrect(task.conceptId, task.card?.id);
  }
  // ... rest unchanged
}
```

- [ ] **Step 4: Instrument `question_answer` (QuestionAnswerTask)**

Find `QuestionAnswerTask` (lines ~67–124). Add `onCardShown` on mount, `onQuality` in `handleQuality`:

```jsx
function QuestionAnswerTask({ task, status, onQualityAnswer, onCardShown, onQuality }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task.card?.id, task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQuality(q) {
    if (status !== "task_active") return;
    onQuality?.(q, task.card?.id, task.conceptId);
    onQualityAnswer(q, task.conceptId, task.card?.id);
  }
  // ... rest unchanged
}
```

- [ ] **Step 5: Pass callbacks through `TASK_RENDERERS` render site**

Find where task components are rendered from the `TASK_RENDERERS` map. The render call passes props to the component. Add `onCardShown`, `onTap`, `onQuality` to the props spread. These come from the parent session player (will be wired in Task 5).

```jsx
// Where TASK_RENDERERS[task.type] is rendered — add the three new optional props:
<TaskComponent
  task={task}
  status={status}
  onCorrect={onCorrect}
  onIncorrect={onIncorrect}
  onQualityAnswer={onQualityAnswer}
  onCardShown={onCardShown}   // ← new
  onTap={onTap}               // ← new
  onQuality={onQuality}       // ← new
  {...otherExistingProps}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/flashcards/index.jsx
git commit -m "feat(analytics): instrument flashcard renderers with event callbacks"
```

---

## Task 5: Wire Logger into Session Lifecycle

**Files:**
- Modify: `src/features/session/sessionEngine.js:58–93`
- Modify: `src/features/session/useSessionEngine.js:118–149`

- [ ] **Step 1: Add `cardEvents` parameter to `computeSessionRecord`**

In `src/features/session/sessionEngine.js`, update the function signature and body:

```javascript
// sessionEngine.js — update computeSessionRecord signature
export function computeSessionRecord(state, studentId, topicId, topicVersion, cardEvents = []) {
  // ... existing logic unchanged ...

  const record = {
    id:             generateId(),
    studentId,
    topicId,
    topicVersion,
    textId:         state.textId ?? undefined,
    modeId:         state.mode.id,
    conceptIds:     state.conceptIds,
    startedAt:      state.startedAt,
    completedAt:    new Date().toISOString(),
    correctCount,
    incorrectCount,
    percentCorrect,
    mistakes:       state.mistakes,
    assessments:    state.assessments?.length ? state.assessments : undefined,
    cardEvents:     cardEvents.length ? cardEvents : undefined,  // ← add this line
  };
  if (!record.textId) delete record.textId;
  return record;
}
```

- [ ] **Step 2: Wire `useCardEventLogger` into `useSessionEngine`**

In `src/features/session/useSessionEngine.js`:

1. Import the hook at the top:
```javascript
import { useCardEventLogger } from "../../features/analytics/useCardEventLogger.js";
```

2. Inside `useSessionEngine`, instantiate the logger:
```javascript
const cardLogger = useCardEventLogger();
```

3. Update `finishSession` to pass card events:
```javascript
async function finishSession(state) {
  const cardEvents = cardLogger.getCardEvents();
  cardLogger.resetCardEvents();
  // ...existing reward/record logic...
  const record = {
    ...computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version, cardEvents),
    reward: { ... },
  };
  // ...rest unchanged...
}
```

4. Return the three logger callbacks alongside existing callbacks:
```javascript
return {
  sessionState,
  completedRecord,
  onCorrect,
  onIncorrect,
  onQualityAnswer,
  onAdvance,
  onMistake,
  onCardShown: cardLogger.onCardShown,   // ← new
  onTap:       cardLogger.onTap,          // ← new
  onQuality:   cardLogger.onQuality,      // ← new
};
```

- [ ] **Step 3: Pass callbacks to session player component**

Find where `useSessionEngine` is consumed (the session player that mounts `TASK_RENDERERS`). Destructure `onCardShown`, `onTap`, `onQuality` from the hook return and pass them down to the renderer component (as set up in Task 4, Step 5).

- [ ] **Step 4: Commit**

```bash
git add src/features/session/sessionEngine.js src/features/session/useSessionEngine.js
git commit -m "feat(analytics): wire useCardEventLogger into session lifecycle"
```

---

## Task 6: Backend — Persist `card_events`

**Files:**
- Modify: `backend/server.mjs:360–368`

- [ ] **Step 1: Find the `appendSession` function in `backend/server.mjs`**

Locate the function that writes session data to SQLite. It currently inserts the known columns. Find the INSERT statement and add `card_events`:

```javascript
// In the function that builds the INSERT for sessions:
db.prepare(`
  INSERT OR IGNORE INTO sessions
    (id, account_id, student_id, topic_id, topic_version, mode,
     started_at, completed_at, correct_count, incorrect_count,
     percent_correct, mistakes, assessments, card_events, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`).run(
  body.id,
  account.id,
  body.studentId,
  body.topicId,
  body.topicVersion ?? "",
  body.modeId ?? body.mode ?? "",
  body.startedAt ?? "",
  body.completedAt ?? "",
  body.correctCount ?? 0,
  body.incorrectCount ?? 0,
  body.percentCorrect ?? 0,
  JSON.stringify(body.mistakes ?? []),
  body.assessments ? JSON.stringify(body.assessments) : null,
  JSON.stringify(body.cardEvents ?? []),   // ← new
  new Date().toISOString(),
);
```

- [ ] **Step 2: Test by running a session end-to-end**

Start the backend (`node backend/server.mjs`) and complete one flashcard session. Then check:

```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('backend/mirocard.db');
const row = db.prepare('SELECT card_events FROM sessions ORDER BY created_at DESC LIMIT 1').get();
console.log(row?.card_events);
"
```

Expected: JSON array of card event objects (or `'[]'` if session had no flashcard events yet — that's fine until Task 4–5 are wired).

- [ ] **Step 3: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(analytics): persist card_events in sessions table"
```

---

## Task 7: Claude Prompt (Versioned)

**Files:**
- Create: `backend/prompts/topic-analysis-v1.md`

- [ ] **Step 1: Create the prompt file**

```markdown
<!-- backend/prompts/topic-analysis-v1.md -->
You are an educational analyst evaluating a child's mastery of flashcard material.

You will receive structured data about a child's sessions for one topic:
- Per-session aggregates: average guessing_score and cards shown
- Per-card history: guessing_score value for each session the card appeared

**guessing_score scale:**
- 0.0–0.3: child answers quickly on first try → strong mastery signal
- 0.3–0.6: some hesitation or retry → learning in progress
- 0.6–1.0: multiple attempts, slow → guessing / not yet learned

**Your task:**
Analyse the data and return a JSON object with this exact shape:

```json
{
  "hypothesis": "усваивает" | "в процессе" | "угадывает",
  "confidence": <float 0.0–1.0>,
  "summary": "<2-3 sentences in Russian, factual and neutral>",
  "cards": [
    {
      "card_id": "<id>",
      "status": "mastered" | "learning" | "guessing",
      "note": "<one sentence in Russian explaining the status>"
    }
  ]
}
```

Rules:
- "hypothesis" reflects the overall trend across ALL sessions, not just the last one
- "confidence" should be lower when there are few sessions (1–2) or inconsistent data
- Write "summary" and "note" in Russian
- Every card_id from the input must appear in "cards"
- Do not add commentary outside the JSON object
```

- [ ] **Step 2: Commit**

```bash
git add backend/prompts/topic-analysis-v1.md
git commit -m "feat(analytics): add versioned Claude analysis prompt v1"
```

---

## Task 8: Backend Analysis Module

**Files:**
- Create: `backend/lib/analysis.mjs`

- [ ] **Step 1: Install Anthropic SDK**

```bash
cd backend && npm install @anthropic-ai/sdk
```

Verify: `backend/node_modules/@anthropic-ai/sdk` exists.

- [ ] **Step 2: Create `backend/lib/analysis.mjs`**

```javascript
// backend/lib/analysis.mjs
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const PROMPT_VERSION = "v1";
const SYSTEM_PROMPT = readFileSync(
  join(__dir, "../prompts/topic-analysis-v1.md"),
  "utf8"
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateAnalysis(db, studentId, topicId) {
  // 1. Check cache
  const cached = db.prepare(
    "SELECT result_json FROM analysis_cache WHERE student_id=? AND topic_id=?"
  ).get(studentId, topicId);
  if (cached) return JSON.parse(cached.result_json);

  // 2. Fetch all sessions with card_events
  const sessions = db.prepare(`
    SELECT started_at, card_events
    FROM sessions
    WHERE student_id=? AND topic_id=?
    ORDER BY started_at ASC
  `).all(studentId, topicId);

  if (sessions.length === 0) return null;

  // 3. Build prompt data
  const promptData = buildPromptData(sessions);

  // 4. Call Claude
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(promptData) }],
  });

  const result = JSON.parse(message.content[0].text);

  // 5. Cache result
  db.prepare(`
    INSERT OR REPLACE INTO analysis_cache
      (student_id, topic_id, prompt_version, generated_at, result_json)
    VALUES (?,?,?,?,?)
  `).run(studentId, topicId, PROMPT_VERSION, Date.now(), JSON.stringify(result));

  return result;
}

function buildPromptData(sessions) {
  const sessionAggregates = [];
  const cardHistories = {}; // cardId → [guessingScore per session]

  for (const s of sessions) {
    const events = JSON.parse(s.card_events ?? "[]");
    const scores = events.map(e => e.guessingScore ?? 0);
    const avg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

    sessionAggregates.push({
      date: s.started_at?.slice(0, 10),
      avg_guessing: avg,
      cards_shown: events.length,
    });

    for (const e of events) {
      if (!cardHistories[e.cardId]) cardHistories[e.cardId] = [];
      cardHistories[e.cardId].push(e.guessingScore ?? 0);
    }
  }

  return { sessions: sessionAggregates, cards: cardHistories };
}
```

- [ ] **Step 3: Ensure `ANTHROPIC_API_KEY` is in `.env`**

Check `backend/.env` (or wherever env vars are loaded). Add if missing:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 4: Commit**

```bash
git add backend/lib/analysis.mjs backend/package.json backend/package-lock.json
git commit -m "feat(analytics): add analysis module with Claude integration and cache"
```

---

## Task 9: Backend Analysis Endpoint

**Files:**
- Modify: `backend/server.mjs`

- [ ] **Step 1: Import `generateAnalysis` at the top of `server.mjs`**

```javascript
import { generateAnalysis } from "./lib/analysis.mjs";
```

- [ ] **Step 2: Add the route handler function**

```javascript
async function handleTopicAnalysis(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.studentId || !body?.topicId) {
    return writeJson(res, 400, { error: "studentId, topicId required" });
  }
  const result = await generateAnalysis(db, body.studentId, body.topicId);
  if (!result) return writeJson(res, 404, { error: "no sessions found" });
  writeJson(res, 200, result);
}
```

- [ ] **Step 3: Register the route**

In the request router (near line 634 where other routes are registered), add:

```javascript
if (method === "POST" && p === "/analysis/topic") return await handleTopicAnalysis(req, res);
```

- [ ] **Step 4: Test the endpoint manually**

Start the backend. With a valid auth token and a student+topic that has sessions, run:

```bash
curl -X POST http://localhost:3000/api/analysis/topic \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"1","topicId":"animals_v2"}'
```

Expected: JSON with `hypothesis`, `confidence`, `summary`, `cards` array.

- [ ] **Step 5: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(analytics): add POST /api/analysis/topic endpoint"
```

---

## Task 10: `AnalyticsScreen` Component

**Files:**
- Create: `src/features/analytics/AnalyticsScreen.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/features/analytics/AnalyticsScreen.jsx
import { useState, useEffect } from "react";
import { api } from "../../core/api.js";

const HYPOTHESIS_COLOR = {
  "усваивает":   "#43a047",
  "в процессе":  "#f57c00",
  "угадывает":   "#c62828",
};

const STATUS_LABEL = {
  mastered: "усвоена",
  learning: "в процессе",
  guessing: "угадывает",
};

const STATUS_COLOR = {
  mastered: "#43a047",
  learning: "#f57c00",
  guessing: "#c62828",
};

export function AnalyticsScreen({ studentId, topicId, topicTitle, onClose }) {
  const [report, setReport] = useState(null);   // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    loadCached();
  }, [studentId, topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCached() {
    try {
      const data = await api.get(`/analysis/topic?studentId=${studentId}&topicId=${topicId}`);
      if (data) setReport(data);
      else setEmpty(true);
    } catch (e) {
      if (e.status === 404) setEmpty(true);
      else setError(e.message);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      // Invalidate cache first, then regenerate
      await api.delete(`/analysis/topic?studentId=${studentId}&topicId=${topicId}`);
      const data = await api.post("/analysis/topic", { studentId, topicId });
      setReport(data);
      setEmpty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button onClick={onClose} style={styles.closeBtn}>←</button>
        <div style={styles.headerTitle}>
          <span style={styles.topicTitle}>{topicTitle}</span>
          {report?.generated_at && (
            <span style={styles.updatedAt}>
              Обновлено {new Date(report.generated_at).toLocaleDateString("ru")}
            </span>
          )}
        </div>
        <button onClick={handleRefresh} disabled={loading} style={styles.refreshBtn}>
          {loading ? "..." : report ? "Обновить" : "Сформировать"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {empty && !loading && (
        <div style={styles.empty}>
          Нажми «Сформировать» чтобы получить первый отчёт
        </div>
      )}

      {report && <ReportBody report={report} />}
    </div>
  );
}

function ReportBody({ report }) {
  const color = HYPOTHESIS_COLOR[report.hypothesis] ?? "#888";
  return (
    <div style={styles.body}>
      {/* Hypothesis */}
      <div style={styles.hypothesisRow}>
        <div style={{ ...styles.dot, background: color }} />
        <span style={styles.hypothesisText}>
          {report.hypothesis} · {Math.round(report.confidence * 100)}% уверенность
        </span>
      </div>

      {/* Summary */}
      {report.summary && <p style={styles.summary}>{report.summary}</p>}

      {/* Cards */}
      <div style={styles.sectionLabel}>Карточки</div>
      {report.cards?.map(card => (
        <CardRow key={card.card_id} card={card} />
      ))}
    </div>
  );
}

function CardRow({ card }) {
  const color = STATUS_COLOR[card.status] ?? "#888";
  return (
    <div style={styles.cardRow}>
      <span style={styles.cardId}>{card.card_id}</span>
      <div style={styles.cardRight}>
        <span style={{ ...styles.statusLabel, color }}>{STATUS_LABEL[card.status]}</span>
      </div>
      {card.note && <span style={styles.cardNote}>{card.note}</span>}
    </div>
  );
}

const styles = {
  screen:         { display:"flex", flexDirection:"column", height:"100%", background:"#fff" },
  header:         { display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:"1px solid #eee" },
  closeBtn:       { fontSize:18, background:"none", border:"none", cursor:"pointer", padding:"4px 8px" },
  headerTitle:    { flex:1, display:"flex", flexDirection:"column" },
  topicTitle:     { fontWeight:600, fontSize:15 },
  updatedAt:      { fontSize:11, color:"#aaa" },
  refreshBtn:     { fontSize:13, padding:"6px 14px", borderRadius:8, border:"1px solid #ddd", cursor:"pointer", background:"#f5f5f5" },
  error:          { padding:"12px 16px", color:"#c62828", fontSize:13 },
  empty:          { padding:"48px 16px", textAlign:"center", color:"#aaa", fontSize:14 },
  body:           { padding:"16px", overflowY:"auto" },
  hypothesisRow:  { display:"flex", alignItems:"center", gap:10, marginBottom:12 },
  dot:            { width:12, height:12, borderRadius:"50%", flexShrink:0 },
  hypothesisText: { fontWeight:600, fontSize:15 },
  summary:        { fontSize:13, color:"#555", lineHeight:1.6, marginBottom:16 },
  sectionLabel:   { fontSize:11, textTransform:"uppercase", color:"#aaa", letterSpacing:.5, marginBottom:8 },
  cardRow:        { padding:"8px 0", borderBottom:"1px solid #f5f5f5", display:"grid", gridTemplateColumns:"1fr auto", gap:"4px 12px", alignItems:"start" },
  cardId:         { fontSize:13, color:"#333", fontWeight:500 },
  cardRight:      { textAlign:"right" },
  statusLabel:    { fontSize:11, fontWeight:600 },
  cardNote:       { fontSize:11, color:"#888", gridColumn:"1/-1" },
};
```

- [ ] **Step 2: Add `GET /analysis/topic` and `DELETE /analysis/topic` endpoints to backend**

The component calls `GET` to load cached data and `DELETE` to invalidate before refresh.

In `backend/server.mjs`, add two more handlers:

```javascript
async function handleGetTopicAnalysis(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://x");
  const studentId = url.searchParams.get("studentId");
  const topicId   = url.searchParams.get("topicId");
  if (!studentId || !topicId) return writeJson(res, 400, { error: "studentId, topicId required" });
  const cached = db.prepare(
    "SELECT result_json, generated_at FROM analysis_cache WHERE student_id=? AND topic_id=?"
  ).get(studentId, topicId);
  if (!cached) return writeJson(res, 404, { error: "not found" });
  writeJson(res, 200, { ...JSON.parse(cached.result_json), generated_at: cached.generated_at });
}

async function handleDeleteTopicAnalysis(req, res) {
  requireAuth(req);
  const url = new URL(req.url, "http://x");
  const studentId = url.searchParams.get("studentId");
  const topicId   = url.searchParams.get("topicId");
  db.prepare("DELETE FROM analysis_cache WHERE student_id=? AND topic_id=?").run(studentId, topicId);
  writeJson(res, 200, { ok: true });
}
```

Register:
```javascript
if (method === "GET"    && p === "/analysis/topic") return await handleGetTopicAnalysis(req, res);
if (method === "DELETE" && p === "/analysis/topic") return await handleDeleteTopicAnalysis(req, res);
```

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/AnalyticsScreen.jsx backend/server.mjs
git commit -m "feat(analytics): add AnalyticsScreen component and GET/DELETE endpoints"
```

---

## Task 11: Wire Entry Point in Topic Library

**Files:**
- Modify: `src/features/topics/TopicLibraryScreen.jsx`

- [ ] **Step 1: Import `AnalyticsScreen`**

```javascript
import { AnalyticsScreen } from "../analytics/AnalyticsScreen.jsx";
```

- [ ] **Step 2: Add analytics state to `TopicLibraryScreen`**

Inside the component, add:

```javascript
const [analyticsTarget, setAnalyticsTarget] = useState(null); // { studentId, topicId, topicTitle }
```

- [ ] **Step 3: Add analytics button to `InstalledTopicItem`**

Find `InstalledTopicItem` (lines 19–39). Add an `onAnalytics` prop and a chart-icon button next to the info button:

```jsx
function InstalledTopicItem({ record, onSelect, onDelete, onInfo, onAnalytics }) {
  return (
    <div ...>
      {/* existing content */}
      <button onClick={() => onInfo(record)} ...>ℹ</button>
      <button
        onClick={e => { e.stopPropagation(); onAnalytics(record); }}
        title="Аналитика"
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"4px 6px" }}
      >
        📊
      </button>
      {/* existing delete button */}
    </div>
  );
}
```

- [ ] **Step 4: Pass `onAnalytics` handler from parent**

In the installed topics list rendering (lines ~222–252), pass the handler:

```jsx
<InstalledTopicItem
  key={record.meta.id}
  record={record}
  onSelect={r => { setActiveTopicId(r.meta.id); setScreen("home"); }}
  onDelete={r => handleDelete(r)}
  onInfo={r => setInfoRecord(r)}
  onAnalytics={r => setAnalyticsTarget({
    studentId: activeStudentId,
    topicId:   r.meta.id,
    topicTitle: r.meta.title ?? r.meta.id,
  })}
/>
```

- [ ] **Step 5: Render `AnalyticsScreen` when `analyticsTarget` is set**

Add conditional render in the screen body (before or after the existing content, as a full-screen overlay):

```jsx
{analyticsTarget && (
  <AnalyticsScreen
    studentId={analyticsTarget.studentId}
    topicId={analyticsTarget.topicId}
    topicTitle={analyticsTarget.topicTitle}
    onClose={() => setAnalyticsTarget(null)}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/topics/TopicLibraryScreen.jsx
git commit -m "feat(analytics): add analytics button to installed topic items"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| `card_events` JSON column on `sessions` | Task 1 |
| `analysis_cache` table | Task 1 |
| `computeGuessingScore` formula | Task 2 |
| `useCardEventLogger` hook | Task 3 |
| Instrument `find_n`, `yes_no`, `choose_word_by_picture`, `question_answer` | Task 4 |
| Include `cardEvents` in session record | Task 5 |
| Persist `card_events` on backend | Task 6 |
| Versioned prompt `topic-analysis-v1.md` | Task 7 |
| Claude integration + cache | Task 8 |
| `POST /analysis/topic` endpoint | Task 9 |
| `GET` and `DELETE /analysis/topic` for cache management | Task 10, Step 2 |
| `AnalyticsScreen` with hypothesis + per-card status | Task 10 |
| Analytics button on topic card, opens screen showing cached report | Task 11 |
| "Обновить" button explicitly triggers Claude call | Task 10 (component logic) |
| Prompt version stored in cache | Task 8 |

**Placeholder scan:** No TBD, no TODO, no "similar to task N" — all code blocks are complete. ✅

**Type consistency:**
- `onCardShown(cardId, conceptId)` — consistent across Task 3, 4, 5 ✅
- `onTap(optionId, isCorrect)` — consistent across Task 3, 4, 5 ✅
- `onQuality(quality, cardId, conceptId)` — consistent across Task 3, 4, 5 ✅
- `cardEvents` (camelCase) — consistent in sessionEngine, useSessionEngine, server ✅
- `generateAnalysis(db, studentId, topicId)` — consistent Task 8 → Task 9 ✅
