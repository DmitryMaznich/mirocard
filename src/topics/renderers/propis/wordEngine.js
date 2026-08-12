import { getPathEndpoints, transformPathD, samplePath, findClosestApproach } from "./pathGeometry.js";
import { GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";

// Points within this margin of a letter's closest approach to the baseline are treated as
// part of its baseline-contact zone — needed because most letters never sample to a
// distance of exactly 0 (the sampled points hit close to, not exactly on, NATIVE_L3).
const BASELINE_CONTACT_TOLERANCE = 1.5;

// Fallback box width for a letter with no viewBox, and the unit every captured
// letter/connector's canvas already uses (tools/letter_capture/handwriting_capture.html).
const DEFAULT_LETTER_BOX_WIDTH = 100;

export function classifyLine(y) {
  let bestLine = GUIDE_LINES[0].line;
  let bestDist = Infinity;
  for (const g of GUIDE_LINES) {
    const dist = Math.abs(y - g.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = g.line;
    }
  }
  return bestLine;
}

export function getConnectionInfo(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getConnectionInfo: item "${item.id}" has no strokes`);
  }
  const entry = getPathEndpoints(strokes[0].d);
  // Defaults to the last stroke — correct whenever every stroke is a real continuation of
  // the glyph (к's diagonal leg, х's second crossing stroke, в's retrace), which is also
  // the default assumption for й/ё: their trailing mark (breve, two dots) is drawn well
  // away from the letter and isn't meant to be the hand-off point, so `mainStrokeIndex: 0`
  // points back at their own main body instead (confirmed 2026-08-11 on "зайка"/"майка": а
  // following letter rendered detached, floating up by й's hat, when the mark's own
  // endpoint was used). э is the opposite case: its main body curls backward (its own real
  // endpoint sits LEFT of where it started — see topic.json's capture), so its trailing
  // stroke is not decorative at all but the actual rightward-continuing tail a real cursive
  // э needs to hand off cleanly — `mainStrokeIndex: 1` there points forward, not
  // back (confirmed 2026-08-12 on "поэт": with the body's own endpoint used, "т" rendered
  // overlapping back into э instead of following it). `mainStrokeIndex` lets a card name
  // whichever stroke is authoritative for its exit point; unset for every other letter.
  const exitStrokeIndex = item.mainStrokeIndex ?? strokes.length - 1;
  const exit = getPathEndpoints(strokes[exitStrokeIndex].d);
  return {
    entryPoint: entry.start,
    exitPoint: exit.end,
    entryLine: classifyLine(entry.start[1]),
    exitLine: classifyLine(exit.end[1]),
  };
}

// A letter's exit/entry "type" (which numbered guide line its connecting stroke belongs
// to) is a fixed property of the letter itself, per Russian cursive methodology — б, в, ф
// all finish with the same loop-back-to-the-line hook regardless of which specific captured
// sample you look at. It is NOT reliably the guide line closest to where one particular
// hand-drawn sample's stroke happens to end: real captures vary (this exact б sample's own
// stroke ends at line 2, в's at line 3, purely from where each artist's pen lifted), so
// classifying by raw geometry alone put б and в in different connector buckets even though
// they take the same connector. Letters confirmed here override classifyLine's geometric
// guess; anything not listed falls back to it. Keyed by `label` (not `id`) to match how the
// rest of the engine identifies which character a card represents (see WriteWordsView's
// lettersByLabel) — test fixtures below intentionally omit `label` so they never collide
// with this table.
// "э" removed 2026-08-12: it was carried over into this list without ever being checked
// against a real capture (э didn't exist in topic.json until this session). Its own raw
// exit point classifies to line 4 (no connector needed, plain hand-off) — forcing line 5
// made the shared loop-back exit connector (conn_5_4) anchor against э's own baseline-
// contact point, which for э's backward-C shape sits mid-stroke rather than near its real
// end, sending the next letter overlapping back into э's own body instead of following it
// (confirmed on "поэт": "т" rendered landing inside "э" rather than after it).
const EXIT_LINE_OVERRIDES = {
  "б": 5, "в": 5, "ф": 5, "о": 5, "ю": 5, "ь": 5, "ъ": 5,
};
// "д" added 2026-08-10: it's in LOWER_ENTRY_LETTERS below (real methodology says it takes
// the same looping entry as а/б/ф) but its own raw capture (entry ~68.67) sits only 0.34
// units closer to line 4 than line 3 — close enough that classifyLine's geometric guess
// missed it, silently skipping conn_4_3 and leaving it as one of the still-uncorrected
// no-connector junctions flagged in docs/propis.md. Not extended to л/м (also in
// LOWER_ENTRY_LETTERS): their own captures already sit almost exactly on line 4 (75.68,
// 75.64), so forcing a connector there would rescale conn_4_3 down to a nearly-flat sliver
// instead of a real loop — a real mismatch to fix by recapturing them with a proper loop, not
// by forcing this override onto a capture that doesn't have one.
const ENTRY_LINE_OVERRIDES = {
  "б": 3, "а": 3, "о": 3, "ф": 3, "д": 3,
};

// о and ю are dual-natured — no fixed connection shape of their own, adapting their own
// entry/exit shape to whichever neighbor requires (this is why о is the only letter with
// multiple captured connection variants — see buildVariantIndex/resolveVariant below).
// Every other letter's behavior is completely unaffected by this.
//
// An earlier version of this file classified a captured variant's entryType (upper/lower)
// and exitType (which neighbor triggers which variant) via three shared height-group tables
// (UPPER/MIDDLE/LOWER_ENTRY_LETTERS) applied to ANY neighboring letter. That model was
// replaced 2026-08-11 after checking it against real captures: entryType turned out to
// depend on nothing but whether the PRECEDING letter is itself dual-nature (see
// resolveVariant's entryType line) — none of б/в/ф/э/ь/ъ force an upper entry the way the
// old model assumed, only о/ю following each other do. And exitType (which neighbor
// triggers which variant) turned out not to reduce to a clean two-way upper/lower split at
// all — the real letter sets per captured variant are irregular (e.g. о_first_l only takes
// л/м/я, not the full old "lower" group) — so each variant card now carries its own explicit
// `nextLetters` list (topic.json) instead of being bucketed through a shared classification.
const DUAL_NATURE_LETTERS = new Set(["о", "ю"]);

// getConnectionInfo plus the fixed per-letter type overrides above, applied only to
// entryLine/exitLine (the classification used to pick a connector) — entryPoint/exitPoint
// stay the letter's own real geometry either way, since bridges must still connect to
// where the pen actually is, not to an abstract type.
export function resolveConnectionInfo(item) {
  const info = getConnectionInfo(item);
  const label = item.label;
  return {
    ...info,
    entryLine: ENTRY_LINE_OVERRIDES[label] ?? info.entryLine,
    exitLine: EXIT_LINE_OVERRIDES[label] ?? info.exitLine,
  };
}

// Where a letter's trajectory last "sits" on the baseline before the previous letter's
// stroke lifts off (last), and where it first sits on the baseline as the next letter's
// stroke touches down (first) — used to anchor a captured exit connector against where the
// previous letter actually sits on the writing line, independent of where the pen happens
// to actually start/end (which can be well above or below the line, mid-loop). Samples
// across ALL of the item's strokes in order, so "first" always comes from the first-drawn
// stroke and "last" from the last — EXCEPT when `mainStrokeIndex` is set (see
// getConnectionInfo's comment for why some letters need one), in which case only that one
// stroke is sampled, so a stroke that isn't the letter's real hand-off point (a decorative
// mark for й/ё, or э's backward-curling main loop) can't be picked up here either, kept
// consistent with whichever stroke getConnectionInfo already treats as authoritative.
export function getBaselineContacts(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getBaselineContacts: item "${item.id}" has no strokes`);
  }
  const relevantStrokes = item.mainStrokeIndex != null ? [strokes[item.mainStrokeIndex]] : strokes;
  const points = relevantStrokes.flatMap((s) => samplePath(s.d));
  return findClosestApproach(points, NATIVE_L3, BASELINE_CONTACT_TOLERANCE);
}

function translateStrokes(strokes, dx, dy = 0) {
  return strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) }));
}

// Marks strokes as part of one continuous pen motion with whatever comes immediately
// before them — the animation player (useLoopingStrokes) skips its usual inter-stroke
// pause for these, since a connecting stroke between letters in a word is never a pen-lift
// the way a letter's own separate strokes are (e.g. "Б"'s crossbar, which stays unmarked
// and keeps the normal pause).
function markContinuous(strokes) {
  return strokes.map((s) => ({ ...s, continuous: true }));
}

// A hand-captured connector's own start point moves to `anchor` (real, measured — where the
// previous letter actually sits) — X stays translate-only, but Y is corrected via an affine
// map so the FAR end always lands exactly on the connector's own canonical toLine, instead of
// wherever its captured shape happens to reach. This used to be translate-only on both axes,
// deliberately, on the theory that any mismatch was a capture-quality problem to fix by
// recapturing — that held up until repeated recaptures (2026-08-09/10) plus an EMA-smoothing
// fix still left every б/в/о-led word ~2 native units off line 4, and comparing captures
// against the reference font path showed why: some letters' own correct shape (e.g. "в")
// never reaches the nominal guide line in the first place (font path's own closest approach
// to L3 is 86.23, not 88) — no amount of better capturing closes that gap, because the
// target line and the letter's real geometry are just not the same number. Scaling Y (not
// stretching to an arbitrary computed point, but to the same canonical ruling line every
// letter without a captured connector already lands on) restores the invariant that mattered
// — "the next piece starts exactly on line 4" — without needing a bridge or a gap. The near
// end (anchor) is untouched; only the reach is corrected, so a bigger anchor/target mismatch
// makes the curve gently more/less steep, not just wrong.
function placeExitConnector(connector, anchor) {
  const info = getConnectionInfo(connector);
  const dx = anchor[0] - info.entryPoint[0];
  const origSpanY = info.exitPoint[1] - info.entryPoint[1];
  const targetLine = GUIDE_LINES.find((g) => g.line === connector.toLine);
  const targetY = targetLine && origSpanY !== 0 ? targetLine.y : info.exitPoint[1] + (anchor[1] - info.entryPoint[1]);
  const scaleY = origSpanY !== 0 ? (targetY - anchor[1]) / origSpanY : 1;
  const translateY = anchor[1] - info.entryPoint[1] * scaleY;
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, scaleY, translateY }) })),
    endPoint: [info.exitPoint[0] + dx, targetY],
  };
}

// connectorsByKey stores an array per line-pair key (see WriteWordsView's grouping) since
// more than one connector can share a fromLine/toLine — e.g. the о/а/б/ф looping entry and
// a straight-diagonal-letters entry (и, к, у...) both go 4→3. A card carries its own
// `forLetters` list (see topic.json) to say which destination letters it's for; a card with
// no `forLetters` is the default for every letter not claimed by a more specific card.
// `letterLabel` is the letter the connector leads into (entry) or out of (exit).
function pickConnector(candidates, letterLabel) {
  if (!candidates) return undefined;
  const specific = candidates.find((c) => c.forLetters?.includes(letterLabel));
  if (specific) return specific;
  return candidates.find((c) => !c.forLetters);
}

// A captured exit connector is keyed by the letter type it attaches to, always ending on
// line 4 (see propisRuling.js's NATIVE_NARROW_MID — the height most letters naturally sit
// at, so it's the universal hand-off point). An entry connector is the mirror case, keyed
// `4_${entryType}` — for letters like о that need their own lead-in stroke from that
// hand-off point rather than starting cold.
function findExitConnector(connectorsByKey, exitType, letterLabel) {
  return pickConnector(connectorsByKey.get(`${exitType}_4`), letterLabel);
}

function findEntryConnector(connectorsByKey, entryType, letterLabel) {
  return pickConnector(connectorsByKey.get(`4_${entryType}`), letterLabel);
}

// Mirrors placeExitConnector's Y-rescale (see its comment), swapped end-for-end: an entry
// connector leads INTO the next letter, so its END must stay exactly on that letter's own
// raw entry point (real, unchanged) — but its START is now corrected to land exactly on the
// connector's own canonical fromLine, instead of wherever its captured shape happens to
// reach. Without this, chaining the same entry-connector letter repeatedly (e.g. "аааааа")
// drifted by a constant ~1 native unit per repetition — confirmed by rebuilding the
// trajectory incrementally letter-by-letter: 69.89, 68.88, 67.87, 66.86, 65.85, 64.84 for
// successive "а"s, each exactly 1.01 apart — because the connector's own start silently
// carried a small mismatch from line 4 into the NEXT junction every single time. X stays
// translate-only, matching placeExitConnector.
function placeEntryConnectorLocal(connector, letterRawEntryPoint) {
  const info = getConnectionInfo(connector);
  const dx = letterRawEntryPoint[0] - info.exitPoint[0];
  const origSpanY = info.exitPoint[1] - info.entryPoint[1];
  const canonicalLine = GUIDE_LINES.find((g) => g.line === connector.fromLine);
  const targetStartY =
    canonicalLine && origSpanY !== 0 ? canonicalLine.y : info.entryPoint[1] + (letterRawEntryPoint[1] - info.exitPoint[1]);
  const scaleY = origSpanY !== 0 ? (letterRawEntryPoint[1] - targetStartY) / origSpanY : 1;
  const translateY = letterRawEntryPoint[1] - info.exitPoint[1] * scaleY;
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, scaleY, translateY }) })),
    startPoint: [info.entryPoint[0] + dx, targetStartY],
  };
}

// Builds baseLabel -> { first: [card...], last: {[entryType]: card}, middle: {lower:
// [card...], upper: [card...]}, any: [card...] } from any cards carrying the
// variantOf/position/entryType/nextLetters metadata (see topic.json's о_middle_*/о_first_*
// cards, added via tools/letter_capture/handwriting_capture.html and merged in by hand). A
// "middle"-position card with no entryType of its own (e.g. о_middle_uu) goes in the
// top-level `any` bucket, not under `middle` — its own entry uses the same generic 4→3
// connector every other letter's plain entry does, so it doesn't care what (if anything)
// precedes о, which makes it just as valid a candidate at position "first" (no preceding
// letter at all) as at "middle" (see resolveVariant). A middle+entryType:"upper" card with
// `alsoFirst: true` (e.g. о_middle_um, captured 2026-08-12) gets pushed into BOTH `middle
// .upper` and `first` — confirmed against real captures: unlike the generic `any` case,
// this one specifically needs о to be either genuinely first (no preceding letter at all)
// OR preceded by о/ю, but must NOT fire for an ordinary preceding letter (entryType
// "lower") the way `any` would, so it can't just be reclassified into `any`. `first`/
// `middle`/`any` arrays are sorted by nextLetters length (shortest/most specific list
// first) so a card with a narrow explicit next-letter list is always tried before a
// broader one, even if two cards' lists happen to overlap. Cards without variantOf are
// ignored, so this is a no-op for every letter that has no variants captured.
function buildVariantIndex(lettersByLabel) {
  const index = new Map();
  for (const card of lettersByLabel.values()) {
    if (!card.variantOf) continue;
    let entry = index.get(card.variantOf);
    if (!entry) {
      entry = { first: [], last: {}, middle: { lower: [], upper: [] }, any: [] };
      index.set(card.variantOf, entry);
    }
    if (card.position === "first") entry.first.push(card);
    else if (card.position === "last") entry.last[card.entryType] = card;
    else if (card.position === "middle") {
      const bucket = card.entryType === "upper" ? entry.middle.upper : card.entryType === "lower" ? entry.middle.lower : entry.any;
      bucket.push(card);
      if (card.alsoFirst) entry.first.push(card);
    }
  }
  const byNextLettersLength = (a, b) => (a.nextLetters?.length ?? Infinity) - (b.nextLetters?.length ?? Infinity);
  for (const entry of index.values()) {
    entry.first.sort(byNextLettersLength);
    entry.middle.lower.sort(byNextLettersLength);
    entry.middle.upper.sort(byNextLettersLength);
    entry.any.sort(byNextLettersLength);
  }
  return index;
}

// A dual-nature letter (о, ю) has no fixed connection shape of its own — resolves to
// whichever captured variant matches its position in the word, its entryType, and (for
// first/middle) whose own `nextLetters` list contains the following letter. entryType is
// "upper" specifically when the PRECEDING letter is itself dual-nature (о or ю) — confirmed
// against real captures 2026-08-11: none of the other letters with their own upper
// EXIT_LINE_OVERRIDES connector (б, в, ф, э, ь, ъ) force an upper entry into о the way an
// earlier version of this function assumed; only handing off from one dual-nature letter
// into another does. An entryType-agnostic card (variants.any, e.g. о_middle_uu) is tried as
// a fallback whenever there's a next letter to match at all — including position "first",
// confirmed 2026-08-11 against "отец": there's no preceding letter for entryType to gate on
// there either, and о_middle_uu's own captured entry already doesn't depend on one, so it's
// just as valid a match for a word-initial о as for one in the middle. Returns null whenever
// no captured variant's nextLetters list matches (or this isn't a dual-nature letter at
// all), letting the caller fall back to the plain isolated card and the ordinary connector
// system exactly as before.
function resolveVariant(variantIndex, label, position, prevLabel, nextLabel) {
  const variants = variantIndex.get(label);
  if (!variants) return null;

  const entryType = prevLabel ? (DUAL_NATURE_LETTERS.has(prevLabel) ? "upper" : "lower") : null;
  const matchesNext = (card) => nextLabel != null && card.nextLetters?.includes(nextLabel);

  if (position === "first") return variants.first.find(matchesNext) || variants.any.find(matchesNext) || null;
  if (position === "last") return (entryType && variants.last[entryType]) || null;
  if (position === "middle") {
    if (!entryType) return null;
    return variants.middle[entryType].find(matchesNext) || variants.any.find(matchesNext) || null;
  }
  return null;
}

function letterBoxWidth(letter) {
  const parts = (letter.viewBox || "").split(" ");
  const w = Number(parts[2]);
  return Number.isFinite(w) && w > 0 ? w : DEFAULT_LETTER_BOX_WIDTH;
}

// Every junction — connector-to-connector, connector-to-letter, or letter-to-letter with no
// captured connector on either side — is an exact snap: the incoming piece's own end point
// becomes the outgoing piece's own start point, with no separate bridge stroke and no fixed
// gap distance ever inserted in between. This was deliberately chosen over the earlier
// "letter never moves vertically, a residual bridge absorbs the mismatch" design: a
// residual bridge closes any gap between two independently hand-drawn connector shapes, but
// since real captures rarely match perfectly, some residual is normal — and every prior
// attempt at auto-correcting it (either by shifting the letter, or by drawing a connecting
// stroke) produced its own visible artifact instead (vertical drift across repeated letters,
// or a bridge whose angle doesn't continue the pen's existing direction).
//
// One exception (2026-08-10, see placeExitConnector): an exit connector's far end IS now
// corrected onto its own canonical toLine, because the drift there turned out not to be a
// capture-quality problem at all — some letters' own correct shape never reaches the nominal
// guide line (confirmed against the reference font path itself, not just hand captures), so
// no amount of recapturing could have closed that gap. Every OTHER junction in this function
// is still a pure exact-snap with no correction: if two independently captured pieces
// mismatch anywhere else, that's still on the capture, not the code.
export function buildWordTrajectory(word, lettersByLabel, connectorsByKey) {
  const chars = Array.from(word);
  if (chars.length === 0) {
    return { strokes: [], totalWidthUnits: 0, viewBox: "0 0 0 150" };
  }

  const variantIndex = buildVariantIndex(lettersByLabel);
  const strokes = [];
  let prev = null; // { exitLine, exitPointWorld, baselineContactWorld, usedVariant, label }
  let rightEdge = 0;

  chars.forEach((ch, i) => {
    let letter = lettersByLabel.get(ch);
    if (!letter) {
      throw new Error(`buildWordTrajectory: letter "${ch}" is not in the letter library`);
    }

    // A dual-nature letter's own captured variant already has its connecting tail(s) baked
    // in as part of the same continuous stroke — when one resolves, this letter is treated
    // exactly like the "no connector found" fallback below on BOTH sides of the junction
    // (usedVariant short-circuits findExitConnector/findEntryConnector further down), so the
    // ordinary connector system never also inserts a redundant separate piece.
    //
    // This also has to reach one letter further than usedVariant itself: a variant's own
    // tail is captured all the way out to wherever the NEXT letter needs to start (e.g.
    // о_middle_uu's own raw end point already sits right at line 3, the same height а
    // straight-stroke letter like т enters at) — so that next letter's own entry connector
    // must be skipped too (see `prev.usedVariant` in the entryConnector line below), or its
    // own separate lead-in stroke duplicates the motion о's tail already made and visibly
    // shifts everything after it (confirmed 2026-08-11 on "работа"/"гот": before this fix,
    // т still got its own straight 4→3 connector immediately after о_middle_uu's tail).
    let usedVariant = false;
    if (DUAL_NATURE_LETTERS.has(ch)) {
      const position = chars.length === 1 ? "isolated" : i === 0 ? "first" : i === chars.length - 1 ? "last" : "middle";
      const prevLabel = i > 0 ? chars[i - 1] : null;
      const nextLabel = i < chars.length - 1 ? chars[i + 1] : null;
      const variant = resolveVariant(variantIndex, ch, position, prevLabel, nextLabel);
      if (variant) {
        letter = variant;
        usedVariant = true;
      }
    }

    const info = resolveConnectionInfo(letter);

    let dx = 0;
    let dy = 0;
    const bridging = !!prev; // was anything (connector) placed before this letter?

    if (prev) {
      const exitConnector = prev.usedVariant ? undefined : findExitConnector(connectorsByKey, prev.exitLine, prev.label);
      const entryConnector = usedVariant || prev.usedVariant ? undefined : findEntryConnector(connectorsByKey, info.entryLine, ch);

      let anchorPoint;
      if (exitConnector) {
        // Real captured connector: place it as-is against where the previous letter
        // actually sits on the baseline — the connector's own length is the distance
        // (see placeExitConnector).
        const placed = placeExitConnector(exitConnector, prev.baselineContactWorld);
        strokes.push(...markContinuous(placed.strokes));
        anchorPoint = placed.endPoint;
      } else {
        // No captured connector for this letter's exit type: the next piece snaps directly
        // onto the previous letter's own raw exit point.
        anchorPoint = prev.exitPointWorld;
      }

      if (entryConnector) {
        // This letter has its own lead-in stroke: placeEntryConnectorLocal already anchored
        // its own end to this letter's real (unshifted) entry point, so the local group
        // (entry connector + letter) shifts by exactly whatever's needed to bring its own
        // start to `anchorPoint` — both axes, no residual left over.
        const localEntry = placeEntryConnectorLocal(entryConnector, info.entryPoint);
        dx = anchorPoint[0] - localEntry.startPoint[0];
        dy = anchorPoint[1] - localEntry.startPoint[1];
        strokes.push(...markContinuous(translateStrokes(localEntry.strokes, dx, dy)));
      } else {
        // No lead-in: the letter's own raw entry point moves to meet `anchorPoint` exactly,
        // both axes.
        dx = anchorPoint[0] - info.entryPoint[0];
        dy = anchorPoint[1] - info.entryPoint[1];
      }
    }

    const placedLetterStrokes = translateStrokes(letter.strokes, dx, dy);
    // Only the letter's own FIRST stroke continues the incoming connector without a pause —
    // any further strokes of this same letter (e.g. "Б"'s separate crossbar) are a genuine
    // pen-lift and keep the normal pause between them.
    if (bridging && placedLetterStrokes.length > 0) {
      placedLetterStrokes[0] = { ...placedLetterStrokes[0], continuous: true };
    }
    strokes.push(...placedLetterStrokes);

    const contacts = getBaselineContacts(letter);
    // A letter whose exitLine classifies to 4 (the universal hand-off point — no connector
    // needed on either end) is EXPECTED to leave the pen sitting exactly on that line, same
    // height as it started; where a raw capture is a couple of units short of it (о_middle_lm's
    // own exit sits at 73, not 75), recording the letter's own uncorrected exitPointWorld here
    // would compound that gap every time this exact letter recurs — each occurrence's own
    // small miss becomes the next one's starting error too. Snapping the recorded Y to the
    // canonical line (without touching the letter's OWN already-drawn shape — this only
    // affects where the NEXT letter anchors) stops the drift from accumulating, the same
    // effect placeExitConnector already gets for real connectors by correcting their far end
    // (confirmed 2026-08-12 on "похож": о_middle_lm recurred twice, each instance shifting
    // the rest of the word up by ~2 units before this fix).
    const exitTargetLine = GUIDE_LINES.find((g) => g.line === 4);
    const exitY = info.exitLine === 4 && exitTargetLine ? exitTargetLine.y : info.exitPoint[1] + dy;
    prev = {
      exitLine: info.exitLine,
      exitPointWorld: [info.exitPoint[0] + dx, exitY],
      baselineContactWorld: [contacts.last[0] + dx, contacts.last[1] + dy],
      usedVariant,
      label: ch,
    };
    rightEdge = Math.max(rightEdge, dx + letterBoxWidth(letter));
  });

  // A captured letter/connector's own raw geometry can dip a few units below x=0 (hand
  // tremor just before a capture slot's left boundary) — harmless for any letter placed
  // mid-word (dx already shifts it right), but the WORD's first letter renders at dx=0, its
  // own native coordinates untouched, so a negative sliver there clips visibly off the left
  // edge of the SVG viewBox (which always starts at x=0). Confirmed to happen in production
  // for "а"/"д" after a capture upload — topic.json has since been corrected too, but this
  // is the durable fix: shift the whole trajectory right by whatever's needed so nothing
  // ever renders left of x=0, regardless of what any future capture's raw data does.
  let minX = 0;
  for (const s of strokes) {
    for (const p of samplePath(s.d)) {
      if (p[0] < minX) minX = p[0];
    }
  }
  if (minX < 0) {
    const shift = -minX;
    for (let i = 0; i < strokes.length; i += 1) {
      strokes[i] = { ...strokes[i], d: transformPathD(strokes[i].d, { translateX: shift }) };
    }
    rightEdge += shift;
  }

  return { strokes, totalWidthUnits: rightEdge, viewBox: `0 0 ${rightEdge} 150` };
}
