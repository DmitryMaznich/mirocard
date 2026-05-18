# Analytics: Child Mastery Hypothesis System

**Date:** 2026-05-18  
**Scope v1:** Flashcard renderer only (`find_n`, `question_answer`, `yes_no`, `choose_word_by_picture`)  
**Goal:** Produce an evidence-based hypothesis about whether a child has mastered or is guessing material in a given topic.

---

## Core Concept

The system distinguishes two behavioral patterns:

- **Guessing** — multiple attempts before correct, slow reaction time, inconsistent across sessions
- **Mastery** — fast first-attempt correct answer, consistent across sessions

The output is a **hypothesis with confidence level**, not a score. Claude provides the interpretation; raw event data provides the evidence.

---

## 1. Data Layer

### 1.1 `card_events` column (added to `sessions` table)

New JSON column `card_events` in the existing `sessions` table. No new table needed.

**Schema per session:**

```json
[
  {
    "card_id": "elephant",
    "concept_id": "animals_elephant",
    "shown_at": 1234567890123,
    "taps": [
      { "option_id": "crocodile", "is_correct": false, "ms": 3200 },
      { "option_id": "elephant",  "is_correct": true,  "ms": 7800 }
    ],
    "first_correct_ms": 7800,
    "attempt_count": 2,
    "guessing_score": 0.61
  }
]
```

For `question_answer` task type (no option grid, self-assessment):

```json
{
  "card_id": "elephant",
  "concept_id": "animals_elephant",
  "shown_at": 1234567890123,
  "quality": "correct",
  "first_correct_ms": 2100,
  "attempt_count": 1,
  "guessing_score": 0.14
}
```

### 1.2 `guessing_score` formula

Weighted composite of attempt count and reaction time, following educational data mining best practices:

```
k = attempt_count
t = first_correct_ms

attempt_signal = 1 - (1 / k)           // 0 for k=1, 0.5 for k=2, 0.67 for k=3
RT_FAST = 1500ms                        // threshold: clearly automatic retrieval
RT_SLOW = 8000ms                        // threshold: clearly searching/guessing
time_signal = clamp((t - RT_FAST) / (RT_SLOW - RT_FAST), 0, 1)

guessing_score = 0.65 × attempt_signal + 0.35 × time_signal
```

Examples:
- k=1, t=800ms → `0.0` (definitely knows)
- k=1, t=3000ms → `0.08` (knows, just thought)
- k=2, t=5000ms → `0.51` (borderline)
- k=3, t=8000ms → `0.78` (likely guessing)
- k=4, t=10000ms → `0.84` (definitely guessing)

### 1.3 `analysis_cache` table (new)

```sql
CREATE TABLE analysis_cache (
  id              INTEGER PRIMARY KEY,
  student_id      INTEGER NOT NULL,
  topic_id        TEXT NOT NULL,
  prompt_version  TEXT NOT NULL,
  generated_at    INTEGER NOT NULL,
  result_json     TEXT NOT NULL,
  UNIQUE(student_id, topic_id)
);
```

Cache is **never auto-invalidated**. User explicitly triggers regeneration via "Обновить" button.

---

## 2. Frontend Instrumentation

### 2.1 `useCardEventLogger` hook

Thin layer on top of existing `useSessionEngine`. Does not modify session logic — purely additive.

**Lifecycle:**
```
card shown     → record { card_id, concept_id, shown_at: Date.now() }
user taps      → append { option_id, is_correct, ms: Date.now() - shown_at }
session ends   → compute guessing_score for each card
               → pass card_events into computeSessionRecord()
```

### 2.2 Renderer changes

Each renderer calls two new callbacks passed from the session layer:

- `onCardShown(card_id, concept_id)` — when card is displayed
- `onTap(option_id, is_correct)` — on each answer tap

Affected renderers:

| Renderer | Change |
|---|---|
| `find_n` | `onCardShown` on mount, `onTap` in click handler |
| `choose_word_by_picture` | `onCardShown` on mount, `onTap` in click handler |
| `yes_no` | `onCardShown` on mount, `onTap` on YES/NO press |
| `question_answer` | `onCardShown` on mount, `onQuality(quality)` instead of `onTap` |

### 2.3 `computeSessionRecord` update

Include `card_events` array in the final session record object, which is persisted to backend via existing `pushOp("session.append", record)`.

---

## 3. Backend: Analysis Endpoint

### 3.1 `POST /api/analysis/topic`

**Request:**
```json
{ "student_id": 5, "topic_id": "animals_v2" }
```

**Steps:**
1. Check `analysis_cache` — if hit, return cached `result_json` immediately
2. Fetch all sessions for `(student_id, topic_id)` with `card_events`
3. Build structured prompt data (see §3.2)
4. Call Claude with versioned prompt (`topic-analysis-v1.md`)
5. Store result in `analysis_cache`
6. Return result

**Response:**
```json
{
  "hypothesis": "усваивает",
  "confidence": 0.78,
  "summary": "За 6 сессий скорость правильного ответа выросла в 3–4 раза...",
  "cards": [
    { "card_id": "elephant", "status": "mastered", "note": "Стабильно быстрый ответ с 4-й сессии" },
    { "card_id": "crocodile", "status": "guessing", "note": "Стабильно высокий guessing_score, без тренда снижения" }
  ],
  "generated_at": 1715000000000
}
```

Card statuses: `"mastered"` | `"learning"` | `"guessing"`

### 3.2 Prompt structure sent to Claude

```
student: <name>, topic: <title>, sessions: <N>, period: <date_from>–<date_to>

Per-session aggregates:
  Session 1 (2026-04-14): avg_guessing=0.81, cards_shown=10
  Session 2 (2026-04-17): avg_guessing=0.74, cards_shown=10
  ...

Per-card history (guessing_score per session):
  elephant:   [0.82, 0.61, 0.34, 0.08, 0.05, 0.04]
  crocodile:  [0.91, 0.88, 0.79, 0.82, 0.76, 0.80]
  ...
```

### 3.3 Versioned prompt file

`backend/prompts/topic-analysis-v1.md`

Contains the system prompt for Claude with:
- Instructions to produce a mastery hypothesis
- Definitions of guessing_score scale
- Output JSON schema
- Language: Russian

Prompt version is stored in `analysis_cache.prompt_version`. Changing the version does **not** auto-invalidate cache — user triggers refresh manually.

---

## 4. UI

### 4.1 Entry point

On the topic picker screen: analytics button (chart icon) added to each topic card, next to the existing info button.

### 4.2 Analytics screen flow

```
Tap 📊 button
  → Screen opens immediately
       ├─ Cache exists → show last report + "Обновлено 2 мая" in header
       └─ No cache    → empty state with "Сформировать отчёт" button

  → "Обновить" / "Сформировать" button in header
       └─ Spinner while waiting for Claude (~10–20 sec)
       └─ Screen updates with new report, cache updated
```

### 4.3 Report screen structure (top to bottom)

1. **Header** — topic name + student name + "Обновлено [date]" + "Обновить" button
2. **Hypothesis row** — colored dot (green/yellow/red) + `"Материал усваивается · 78% уверенность"`
3. **Session trend bar** — one bar per session, height = share of non-guessing cards, color = green→red gradient
4. **Cards list** — per card: emoji/name + 5 dots (last 5 sessions, colored by guessing_score) + status label
5. **Claude summary** — 2–3 sentences, factual, neutral tone

### 4.4 Dot color encoding

| guessing_score | Color |
|---|---|
| 0.0–0.3 | Green (усвоена) |
| 0.3–0.6 | Orange (в процессе) |
| 0.6–1.0 | Red (угадывает) |
| No data | Grey |

---

## 5. Out of Scope (v1)

- Other renderers (comparison, reading, math_houses, etc.) — tracked but not analyzed
- Push notifications for report readiness
- Automatic report generation after sessions
- Cross-topic analysis
- Export / share report

---

## 6. Open Questions

- None — all design decisions resolved in brainstorming session.
