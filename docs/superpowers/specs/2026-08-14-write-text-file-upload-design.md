# write_text: upload a .txt file instead of typing the practice text

## Context

propis's "Пишем текст" (write_text) mode currently starts every session
with an empty text buffer — the only way to get text onto the notebook
grid is tapping the on-screen keyboard one letter at a time. Typing a
whole practice text this way is slow. This spec adds a way to seed the
session with text uploaded from a `.txt` file, on the mode's settings
screen (`ParamsScreen.jsx`), before the session starts. The uploaded text
remains fully editable afterward with the on-screen keyboard — the file
just replaces the tedious initial typing, not the keyboard itself.

## Decisions (confirmed with the user)

1. **Editable after load.** The uploaded text is a starting point, not a
   locked assignment — the keyboard, `←`, and `Очистить` all keep working
   exactly as they do today.
2. **Length limit: 200 characters.** This is a handwriting-practice mode,
   not a reading mode — a reasonable session is a few short sentences, not
   a document. A file whose (trimmed) text exceeds 200 characters is
   **rejected outright** with a clear error message stating the limit and
   the file's actual length; any previously-loaded text is left
   untouched.
3. **No alphabet/character filtering.** Uploaded text is not restricted to
   captured Cyrillic letters. `WriteTextView`'s existing fallback-glyph
   mechanism (`buildWordSegments` in `wordEngine.js`) already renders any
   uncaptured character — including uppercase letters beyond А/Б/В/Г,
   digits, punctuation, or stray Latin characters — as a plain system-font
   glyph inline. Duplicating that filtering on the upload path would be
   redundant.

## Architecture

### Reuse the existing declarative params system — no bespoke branch

`ParamsScreen.jsx` already has a generic, schema-driven params renderer:
`mode.params` (from `topic.json`) is a `{ [key]: { type, label, ... } }`
map, and `renderParam(key, def)` dispatches on `def.type` to a dedicated
component (`NumberStepper`, `EnumParam`, `BooleanParam`,
`SentenceListParam`, ...). Values live in local `params` state
(`params[key]`), saved via the same `persistStudentTopicLink(...,
{ params, ... })` call every other param already goes through, and restored
next time via `getInitialParams()`'s `saved[key] ?? default` pattern. This
is a generically-reusable mechanism, not propis-specific — some topics
instead get a fully bespoke UI branch (`isReading`, `isSymmetryDrawPrint`,
`WrittenLettersPairParams`) when their needs don't fit the schema at all,
but a single "one string value, editable, persisted" field fits the
existing `sentence_list` shape closely enough that inventing a new bespoke
branch would just duplicate plumbing this system already provides for
free (including remembering the last upload across visits to this screen,
the same way `sentence_list` remembers custom sentences).

New param type: **`"text_upload"`**.

### Files touched

- **`tools/propis/topic.json`** — add to the `write_text` mode entry:
  ```json
  "params": {
    "customText": {
      "type": "text_upload",
      "label": { "ru": "Свой текст" },
      "maxLength": 200
    }
  }
  ```
  Bump `topic.meta.version` (patch), rebuild the deck zip, update
  `catalog.json` — the existing propis deck-release flow
  (`docs/propis.md`'s "Ingesting new captures" section describes the same
  version-bump-and-rebuild step for data changes; this is a manifest-only
  change, same mechanics).

- **`src/features/session/ParamsScreen.jsx`**:
  - `getInitialParams()`: add a branch alongside the existing
    `sentence_list`/`enum_multi` special cases:
    ```js
    if (def.type === "text_upload") {
      out[key] = saved[key] ?? "";
      continue;
    }
    ```
  - `renderParam()`: add a branch alongside the existing `sentence_list`
    case:
    ```js
    if (def.type === "text_upload") {
      return (
        <TextUploadParam
          key={key}
          label={def.label?.ru ?? key}
          maxLength={def.maxLength}
          value={params[key] ?? ""}
          onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
        />
      );
    }
    ```
  - New local component `TextUploadParam` (defined in this file, next to
    `SentenceListParam` — same reasoning: a generic param-type renderer,
    not a per-topic component, so it belongs with the other type
    renderers, not in its own file the way `SymmetryDrawPrintParams` is
    — that one is a bespoke per-topic branch, a different category).

- **`src/topics/renderers/propis/engine.js`** — `generateTasks` currently
  has signature `(mode, cards)` and silently ignores the `sessionSize`/
  `sessionParams` arguments `useSessionEngine.js`'s generic branch already
  passes it (`generateTasks(mode, cardsForEngine, sessionSize,
  sessionParams)` — confirmed via code search, this is a pre-existing gap
  unrelated to this feature, not something introduced here). Change:
  ```js
  export function generateTasks(mode, cards, sessionSize, sessionParams) {
    ...
    if (mode.type === "write_text") {
      return [{ type: "write_text", letters, connectors, initialText: sessionParams?.customText ?? "" }];
    }
    ...
  }
  ```
  No other mode branch changes — `sessionSize` stays unused by every
  propis mode exactly as today (propis modes aren't sized/repeated the
  way flashcard-style topics are), only `write_text` newly reads
  `sessionParams`.

- **`src/topics/renderers/propis/WriteTextView.jsx`**:
  ```js
  const [text, setText] = useState(task?.initialText ?? "");
  ```
  That's the only change needed here — every other piece (the keyboard
  handlers, `layoutTextIntoRows`, the tap-to-animate feature) already
  operates on whatever `text` currently holds, regardless of how it got
  there.

### `TextUploadParam` component

Modeled on `SentenceListParam`'s shape (a `.param-row--block` with a
`param-label`, matching the established visual language — teal accent,
same as every other control on this screen) but replacing the textarea
with a file-upload control:

```jsx
function TextUploadParam({ label, maxLength, value, onChange }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same filename after an error/clear
    if (!file) return;
    let raw;
    try {
      raw = await file.text();
    } catch {
      setError("Не удалось прочитать файл. Убедитесь, что это текстовый .txt файл.");
      return;
    }
    const normalized = raw.replace(/\r\n?/g, "\n").trim();
    if (normalized.length > maxLength) {
      setError(`Слишком длинный текст: ${normalized.length} символов, максимум ${maxLength}.`);
      return;
    }
    setError(null);
    onChange(normalized);
  }

  return (
    <div className="param-row param-row--block param-text-upload">
      <div className="param-label">{label}</div>
      <div className="param-text-upload__body">
        {value ? (
          <>
            <div className="param-text-upload__preview">{value}</div>
            <div className="param-text-upload__actions">
              <button type="button" onClick={() => fileRef.current?.click()}>Заменить файл</button>
              <button type="button" onClick={() => onChange("")}>Очистить</button>
            </div>
          </>
        ) : (
          <button type="button" className="param-text-upload__trigger" onClick={() => fileRef.current?.click()}>
            📄 Загрузить .txt
          </button>
        )}
        {error && <div className="param-text-upload__error">{error}</div>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="param-text-upload__input"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
```

(The plan will pin down exact class names/CSS and confirm the hidden-file-input styling convention against `TopicImport.jsx`'s real markup rather than restating it here.)

## Not in scope

- No manual free-text entry on `ParamsScreen` itself (typing still only
  happens via `WriteTextView`'s own keyboard, after the session starts) —
  the point of this feature is specifically to skip typing on this
  screen.
- No character-set filtering/validation beyond the length cap (see
  Decision 3).
- No change to `write_words`/`practice` modes, or to any other topic's
  params.

## Testing

- `propis/engine.js`'s `generateTasks` gains a new behavior (reading
  `sessionParams.customText`) — this is plain, already-unit-tested-style
  logic; add a focused test asserting `write_text`'s task carries
  `initialText` from `sessionParams.customText`, and defaults to `""`
  when absent (existing call sites that don't pass `sessionParams` at all
  must keep working).
- `TextUploadParam` and the `ParamsScreen` wiring are UI/interaction code
  with no existing test coverage precedent in this file (none of
  `NumberStepper`/`EnumParam`/`SentenceListParam` have dedicated tests
  either) — verify live in the browser: upload a short file (loads and
  shows preview), upload an oversized file (rejected, error shown,
  previous value untouched if any), clear, replace, then start a session
  and confirm `WriteTextView` opens with the uploaded text already on the
  grid and still editable.
