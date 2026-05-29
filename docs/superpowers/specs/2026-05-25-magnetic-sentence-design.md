# Magnetic Alphabet — Sentence Modes Design

**Date:** 2026-05-25  
**Topic:** `magnetic_alphabet`

## Overview

Two new modes for the Magnetic Alphabet topic: a child types a given sentence using magnetic letters, then copies it to a notebook.

## New Modes

### `magnetic_sentence` — Text Visible
The target sentence is shown at the top while the child assembles it.

### `magnetic_sentence_audio` — Audio + From Memory
A "Listen" button plays the pre-recorded audio (or shows the text as fallback). The sentence is hidden; the child must recall and assemble it from memory.

## Architecture

**New file:** `src/topics/renderers/magnetic_alphabet/MagneticSentenceView.jsx`  
Handles both modes via an `audioMode` boolean prop. Self-contained: includes its own canvas + keyboard (same drag-and-drop logic as the existing renderer). No shared-component refactor — YAGNI.

Props: `sentences` (string[]), `topicSentences` (full objects from topicRecord with `audio` field), `audioMode`, `layout`, `soundEnabled`, `playTopicFile`, `playFeedback`, `onCorrect`, `onAdvance`.

Audio lookup: for each sentence string, find matching object in `topicSentences` by `text` field to get the audio file path. Custom sentences (not in topicSentences) have no audio → fallback to showing text.

**Modified files:**
- `src/topics/renderers/magnetic_alphabet/index.jsx` — route `magnetic_sentence` and `magnetic_sentence_audio` to `MagneticSentenceView`
- `src/topics/renderers/magnetic_alphabet/magnetic_alphabet.css` — styles for new phases
- `src/features/session/ParamsScreen.jsx` — handle new `sentence_list` param type
- `tools/magnetic_alphabet/topic.json` — add two modes + `sentences` array

## Data Structure

### `topic.json` additions

```json
"sentences": [
  { "id": "s1", "text": "Мама мыла раму.", "audio": "media/s1.mp3" },
  { "id": "s2", "text": "У кота большие усы.", "audio": "media/s2.mp3" }
]
```

### New mode definition (same shape for both modes)

```json
{
  "id": "magnetic_sentence",
  "type": "magnetic_sentence",
  "ui": {
    "title": "Предложение (текст)",
    "instruction": "Прочитай и составь предложение из букв"
  },
  "params": {
    "layout": { "type": "enum", ... },
    "sentences": {
      "type": "sentence_list",
      "label": { "ru": "Предложения" },
      "source": "topic.sentences"
    }
  }
}
```

### Session params

`params.sentences: string[]` — list of sentence strings selected by the teacher.

## Session Params UI

`ParamsScreen.jsx` gets a new branch for `sentence_list` type → renders `SentenceListParam` component:
- Checkboxes for each predefined sentence from `topic.sentences`
- Textarea for custom sentences (one per line)
- Combined result stored in `params.sentences`
- `getInitialParams()` initialises `sentence_list` params to `[]`

**Validation:** "Start" button is disabled if `params.sentences` is empty.

## UX Flow (per sentence)

### Phase 1 — `assemble`

**Text mode:** read-only sentence shown in a top bar.  
**Audio mode:** "Listen" button → plays audio file via `playTopicFile`; sentence text hidden. If no audio file exists for the sentence, shows text instead (graceful fallback, no error).

Child builds the sentence using the magnetic keyboard (drag-and-drop). "Check" button is disabled while canvas is empty.

On correct: call `onCorrect()` (for session statistics) + play success sound → `phase → "success"`.  
On incorrect: play error sound, canvas stays editable.

### Phase 2 — `success`

1.5 s green animation → `phase → "copy"`.

### Phase 3 — `copy`

- CSS animation: hand with pen moving toward a notebook (SVG/CSS, no external assets)
- Large display of **what the child actually assembled** (`getTextFromLines(lines)`) — not the target text
- "Done" button appears immediately (teacher controls the pace)
- Press "Done" → clear canvas, `sentenceIdx++`
- If all sentences done → call `onAdvance()`

## Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| Empty sentence list | "Start" button disabled in ParamsScreen |
| Audio mode + no audio file | Show sentence text instead of playing |
| Empty canvas + "Check" pressed | Button disabled — not possible |
| Wrong assembly | Error sound, canvas stays, child corrects |
