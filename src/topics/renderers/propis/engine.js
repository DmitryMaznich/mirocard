import { shuffle } from "@/shared/utils/shuffle";
import {
  letterDictationKey,
  isUpperCaseLetterCard,
  letterSoundDictationKey,
  wordDictationKey,
  textDictationKey,
  textSentenceDictationKey,
  splitIntoSentences,
} from "./dictationAudio";
import { generateLetterTasks } from "./letters/lettersEngine.js";
import { LETTER_DATA } from "./letters/letterData.js";

// Plain shuffle can put "А" right next to "а" (same letter, different pool entries for case)
// or, in principle, any two items that read as "the same thing twice in a row" -- reported
// as a real dictation session confusion, 2026-09-24. Picks a random itemCount-sized subset
// same as before, then arranges it so no two ADJACENT items share `keyFn`'s value: bucket by
// key, sort buckets largest-first, round-robin across all buckets each pass. Standard
// rearrangement-problem shape, correct whenever the largest bucket is at most half the total
// (always true here -- a letter has at most 2 case variants, so no bucket can ever exceed 2).
function shuffleNoAdjacentRepeats(pool, itemCount, keyFn) {
  const picked = shuffle(pool).slice(0, itemCount);
  const buckets = new Map();
  for (const item of picked) {
    const k = keyFn(item);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(item);
  }
  const bucketList = shuffle([...buckets.values()]).sort((a, b) => b.length - a.length);
  const result = [];
  let remaining = picked.length;
  while (remaining > 0) {
    for (const bucket of bucketList) {
      if (bucket.length) {
        result.push(bucket.shift());
        remaining -= 1;
      }
    }
  }
  return result;
}

export function generateTasks(mode, cards, sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  // "Диктант" needs the full word/text banks, not just cards -- topicRecord is passed through
  // whole for this renderer (see useSessionEngine.js's dedicated propis branch), so these are
  // simply absent (undefined -> []) for every other mode, which never had them to begin with.
  const wordBank = Array.isArray(cards) ? [] : (cards?.words ?? []);
  const textBank = Array.isArray(cards) ? [] : (cards?.texts ?? []);
  // Pre-writing elements (крючки, петли...) for read_lines' "Элементы букв" option -- bundled
  // into the deck separately from `cards` (build-propis-deck.mjs merges tools/propis/elements.json
  // into topic.json's own `elements` key), same reasoning as words/texts above.
  const elementBank = Array.isArray(cards) ? [] : (cards?.elements ?? []);
  const wideBank = Array.isArray(cards) ? [] : (cards?.wide ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");
  // Punctuation is captured ink too, but it's not a letter: it never takes a connector and
  // never chains into a word the way buildWordTrajectory chains letters (see wordEngine.js's
  // buildWordSegments) -- kept as its own card type specifically so it's excluded from
  // `letters`/lettersByLabel and can't accidentally be swept into that machinery.
  const punctuation = withStrokes.filter((c) => c.type === "punctuation");
  // "о"'s own joint-stroke variants (variantOf set, e.g. "о_middle_ll") exist purely as
  // internal lookup data for wordEngine.js's buildVariantIndex/buildWordSegments -- their
  // `label` is an internal id, not a real letter, so they must never be offered as a
  // standalone "letter" to practice/show/dictate. `letters` itself stays unfiltered (kept
  // as-is below) because write_words/write_text/read_text/print_page need the variants
  // present for buildVariantIndex to find them.
  const standaloneLetters = letters.filter((c) => !c.variantOf);

  // Letter-recognition modes, merged in from the former "Письменные буквы" topic (2026-09-29).
  // Pairing/similarity data comes from LETTER_DATA; the ink itself is drawn from this topic's
  // own cards at render time (LetterGlyphProvider in index.jsx), so no strokes ride on tasks.
  if (mode.type === "letters_recognize") {
    const direction = sessionParams?.direction ?? "print_to_written";
    if (direction === "mix") {
      return shuffle([
        ...generateLetterTasks("match_print_to_written", LETTER_DATA),
        ...generateLetterTasks("match_written_to_print", LETTER_DATA),
      ]);
    }
    return generateLetterTasks(
      direction === "written_to_print" ? "match_written_to_print" : "match_print_to_written",
      LETTER_DATA,
    );
  }

  if (mode.type === "letters_case") {
    return (sessionParams?.variant ?? "sort") === "pair"
      ? generateLetterTasks("match_pair", LETTER_DATA, sessionSize, sessionParams ?? {})
      : generateLetterTasks("sort_case", LETTER_DATA);
  }

  if (mode.type === "letters_alphabet") {
    return generateLetterTasks("alphabet_pairs", LETTER_DATA, sessionSize, sessionParams ?? {});
  }

  if (mode.type === "practice") {
    return [{ type: "practice", items: standaloneLetters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: standaloneLetters }];
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
    let lines = (sessionParams?.lines ?? []).map((l) => l.trim()).filter(Boolean);
    // Ready-made workbook sheets ("Широкая строка" -> "Листы методики, часть 1"): replaces the
    // typed lines with the transcribed original pages (wide.json `sheets`).
    const narrowRows = Boolean(sessionParams?.narrowRows);
    const sheetLines = sessionParams?.wideRows && sessionParams?.wideSheet6 ? cards?.wideSheets?.page7
      : sessionParams?.wideRows && sessionParams?.wideSheet5 ? cards?.wideSheets?.page6
      : sessionParams?.wideRows && sessionParams?.wideSheet4 ? cards?.wideSheets?.page5
      : sessionParams?.wideRows && sessionParams?.wideSheet3 ? cards?.wideSheets?.page4
      : sessionParams?.wideRows && sessionParams?.wideSheet2 ? cards?.wideSheets?.page3
      : sessionParams?.wideRows && sessionParams?.wideSheet ? cards?.wideSheets?.part1
      : narrowRows && sessionParams?.narrowSheet6 ? cards?.wideSheets?.page12
      : narrowRows && sessionParams?.narrowSheet5 ? cards?.wideSheets?.page11
      : narrowRows && sessionParams?.narrowSheet4 ? cards?.wideSheets?.page10
      : narrowRows && sessionParams?.narrowSheet3 ? cards?.wideSheets?.page9
      : narrowRows && sessionParams?.narrowSheet2 ? cards?.wideSheets?.page8
      : narrowRows && sessionParams?.narrowSheet ? cards?.wideSheets?.part2 : null;
    if (Array.isArray(sheetLines)) lines = sheetLines;
    // "Элементы букв" (2026-09-17): when on, each line's string is an ELEMENT ID (picked from
    // ElementPickerModal in ParamsScreen.jsx, not typed) instead of text -- PrintPageView.jsx
    // needs the element bank to resolve those ids into strokes, same as letters/connectors.
    const useElements = Boolean(sessionParams?.useElements);
    // "Широкая строка" (методика, часть 1): lines are typed text (glyph labels / words), drawn
    // from the wide-zone captures in `wide` (tools/propis/wide.json) on wide-band-only ruling.
    const wideRows = Boolean(sessionParams?.wideRows) || narrowRows; // narrow rows use the same captured glyphs, drawn at half size
    return [{ type: "print_page", letters, connectors, punctuation, lines, useElements, elements: elementBank, wideRows, narrowRows, wideGlyphs: wideBank, wideElementRepeat: Array.isArray(cards) ? {} : (cards?.wideElementRepeat ?? {}) }];
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
      // isUpper/soundKey let DictationView play "заглавная"/"строчная" (case word, shared
      // across every letter) then the letter's own sound as two clips back to back -- see
      // dictationAudio.js's caseWordDictationKey/letterSoundDictationKey.
      pool = standaloneLetters.map((l) => ({
        key: letterDictationKey(l),
        display: l.label,
        isUpper: isUpperCaseLetterCard(l),
        soundKey: letterSoundDictationKey(l),
      }));
    }

    const itemCount = Math.max(1, Math.min(sessionParams?.itemCount ?? 10, pool.length || 1));
    // .toLowerCase() specifically so "А" and "а" (separate pool entries, same base letter)
    // never land back to back -- the concern that prompted this (see the function's own
    // comment above); a no-op for words/texts, whose entries never collide after lowercasing.
    const items = shuffleNoAdjacentRepeats(pool, itemCount, (item) => (item.display ?? "").toLowerCase());

    // letters/connectors/punctuation ride along so the end-of-session review screen can
    // render the answers as real captured cursive ink on real ruled paper (same primitives
    // as ReadTextView/PrintPageView), not typed UI text -- letters stays the FULL unfiltered
    // set (including variants) since layoutTextIntoRows's buildVariantIndex needs them.
    return [{ type: "dictation", level, items, repeatLimit, videoRewardEnabled, letters, connectors, punctuation }];
  }

  return [];
}
