import { shuffle } from "@/shared/utils/shuffle";
import {
  letterDictationKey,
  wordDictationKey,
  textDictationKey,
  textSentenceDictationKey,
  splitIntoSentences,
} from "./dictationAudio";

export function generateTasks(mode, cards, sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  // "Диктант" needs the full word/text banks, not just cards -- topicRecord is passed through
  // whole for this renderer (see useSessionEngine.js's dedicated propis branch), so these are
  // simply absent (undefined -> []) for every other mode, which never had them to begin with.
  const wordBank = Array.isArray(cards) ? [] : (cards?.words ?? []);
  const textBank = Array.isArray(cards) ? [] : (cards?.texts ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");
  // Punctuation is captured ink too, but it's not a letter: it never takes a connector and
  // never chains into a word the way buildWordTrajectory chains letters (see wordEngine.js's
  // buildWordSegments) -- kept as its own card type specifically so it's excluded from
  // `letters`/lettersByLabel and can't accidentally be swept into that machinery.
  const punctuation = withStrokes.filter((c) => c.type === "punctuation");

  if (mode.type === "practice") {
    return [{ type: "practice", items: letters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: letters }];
  }

  if (mode.type === "write_words") {
    return [{ type: "write_words", letters, connectors }];
  }

  if (mode.type === "write_text") {
    return [{ type: "write_text", letters, connectors, punctuation, initialText: sessionParams?.customText ?? "" }];
  }

  if (mode.type === "read_text") {
    // One task holding every selected text, not one task per text -- ReadTextView
    // switches between them with its own internal Prev/Next (same self-contained-state
    // pattern PropisPracticeView already uses for letter/case switching), rather than
    // relying on the session engine's own task-advance machinery, which no other propis
    // mode exercises today.
    return [{ type: "read_text", letters, connectors, punctuation, texts: sessionParams?.texts ?? [] }];
  }

  if (mode.type === "read_lines") {
    // Own task/view (PrintPageView.jsx), not a read_text reuse anymore (2026-09-13 rework):
    // the fixed-page/real-print-geometry rendering (PRINT_ROWS_PER_PAGE, red margin line,
    // A5-proportioned page, PDF export) diverges too much from read_text's flowing/scrolling
    // layout to share a view, even though both still build on the same
    // layoutTextIntoRows/AnimatedStrokes primitives. `lines` is passed through raw (not
    // pre-joined) so PrintPageView can paginate it itself (paginateRows, wordEngine.js).
    // Blank lines are dropped -- the constructor lets a parent leave half-filled draft rows
    // without them showing up on the child's screen.
    const lines = (sessionParams?.lines ?? []).map((l) => l.trim()).filter(Boolean);
    return [{ type: "print_page", letters, connectors, punctuation, lines }];
  }

  if (mode.type === "browse") {
    // Ready-made print PDFs (notebooks + worksheets), migrated in from the standalone
    // print_materials topic (2026-09-15) -- categories/items live on topic.json itself,
    // not built from cards, so PrintMaterialsView reads topicRecord directly rather than
    // this task.
    return [{ type: "browse", id: "print_browse" }];
  }

  if (mode.type === "dictation") {
    const level = sessionParams?.level ?? "letters";
    const repeatLimit = sessionParams?.unlimitedRepeats ? null : (sessionParams?.repeatLimit ?? 3);
    const videoRewardEnabled = Boolean(sessionParams?.videoRewardEnabled);

    // Each pool maps to { key, display } -- `key` is what the (not-yet-written) audio
    // player looks up via dictationAudioUrl(key), `display` is the plain text shown on the
    // end-of-session comparison screen, spelled exactly as it should land in the notebook.
    let pool;
    if (level === "words") {
      pool = wordBank.map((w) => ({ key: wordDictationKey(w), display: w.word }));
    } else if (level === "texts") {
      // One dictation item per text, but each item carries its own `sentences` list --
      // dictated one at a time with a pause between them (user's call, 2026-09-17), not the
      // whole text in one breath. `display` on the item stays the full text (what the
      // end-of-session comparison screen shows); `sentences[].display` is what the
      // (not-yet-written) session view actually steps through and plays.
      pool = textBank.map((t) => ({
        key: textDictationKey(t),
        display: t.text,
        sentences: splitIntoSentences(t.text).map((s, i) => ({
          key: textSentenceDictationKey(t, i),
          display: s,
        })),
      }));
    } else {
      pool = letters.map((l) => ({ key: letterDictationKey(l), display: l.label }));
    }

    const itemCount = Math.max(1, Math.min(sessionParams?.itemCount ?? 10, pool.length || 1));
    const items = shuffle(pool).slice(0, itemCount);

    return [{ type: "dictation", level, items, repeatLimit, videoRewardEnabled }];
  }

  return [];
}
