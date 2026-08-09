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
  const exit = getPathEndpoints(strokes[strokes.length - 1].d);
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
const EXIT_LINE_OVERRIDES = {
  "б": 5, "в": 5, "ф": 5, "о": 5, "э": 5, "ю": 5, "ь": 5, "ъ": 5,
};
const ENTRY_LINE_OVERRIDES = {
  "б": 3, "а": 3, "о": 3, "ф": 3,
};

// Real Russian cursive methodology also classifies where a letter's OWN first stroke
// begins into three height groups — what a PRECEDING letter needs to match when handing
// off into it (sources: studfile.net/preview/9752060, poznayka.org/s52463t1, runninglines.ru
// /verhnee-soedinenie — cross-referenced in conversation/commit history). Almost every
// letter has exactly one fixed group regardless of context; о and ю are the named exception
// — dual-natured, with no group of their own, adapting their own entry/exit shape to
// whichever neighbor requires (this is why о is the only letter with multiple captured
// connection variants — see DUAL_NATURE_LETTERS and buildVariantIndex below). Every other
// letter's behavior is completely unaffected by any of this.
const UPPER_ENTRY_LETTERS = new Set(["и", "к", "т", "р", "с", "н", "у", "ц"]);
const MIDDLE_ENTRY_LETTERS = new Set(["е", "з", "ж", "г", "х", "ш", "ч", "э", "в"]);
const LOWER_ENTRY_LETTERS = new Set(["а", "б", "д", "ф", "л", "м", "я"]);
const DUAL_NATURE_LETTERS = new Set(["о", "ю"]);

function entryHeightGroup(label) {
  if (UPPER_ENTRY_LETTERS.has(label)) return "upper";
  if (MIDDLE_ENTRY_LETTERS.has(label)) return "middle";
  if (LOWER_ENTRY_LETTERS.has(label)) return "lower";
  return null;
}

// No middle-height exit variant has been captured yet for any dual-nature letter (only
// upper/lower — see topic.json's о_middle_*/о_first_* cards) — approximate "middle" as
// "upper" until one exists, and default unclassified neighbors (an uncaptured letter, or
// another dual-nature one) to "upper" too, since that's the documented default for most of
// the alphabet.
function simplifyToUpperLower(group) {
  return group === "lower" ? "lower" : "upper";
}

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
// stroke and "last" from the last.
export function getBaselineContacts(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getBaselineContacts: item "${item.id}" has no strokes`);
  }
  const points = strokes.flatMap((s) => samplePath(s.d));
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

// A hand-captured connector's own start point moves to `anchor` — translation only, never
// rescaled. The connector's own drawn length and shape ARE the correct distance and shape
// for this letter's exit type; stretching it to hit some independently computed target
// point defeats the point of having a real captured connector at all. Returns the
// translated strokes plus where its own end point landed, which becomes the anchor point
// the next piece (entry connector, or the letter directly) snaps its own start to exactly —
// see buildWordTrajectory. Any mismatch between two independently hand-drawn pieces is not
// papered over in code; it's on the capture quality itself (see the exit/entry connector
// design note there).
function placeExitConnector(connector, anchor) {
  const info = getConnectionInfo(connector);
  const dx = anchor[0] - info.entryPoint[0];
  const dy = anchor[1] - info.entryPoint[1];
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) })),
    endPoint: [info.exitPoint[0] + dx, info.exitPoint[1] + dy],
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

// Mirrors placeExitConnector: translate-only, anchored by its own END point instead — an
// entry connector leads INTO the next letter, so its end lands on that letter's own raw
// entry point (in the letter's local, pre-placement coordinates) and its start is wherever
// that naturally puts it, which is what an incoming exit connector (or the previous
// letter's own exit point, if it has no captured exit connector) then snaps to exactly.
function placeEntryConnectorLocal(connector, letterRawEntryPoint) {
  const info = getConnectionInfo(connector);
  const dx = letterRawEntryPoint[0] - info.exitPoint[0];
  const dy = letterRawEntryPoint[1] - info.exitPoint[1];
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) })),
    startPoint: [info.entryPoint[0] + dx, info.entryPoint[1] + dy],
  };
}

// Builds baseLabel -> { first: {[exitType]: card}, last: {[entryType]: card}, middle:
// {[`${entryType}_${exitType}`]: card} } from any cards carrying the variantOf/position/
// entryType/exitType metadata (see topic.json's о_middle_*/о_first_* cards, added via
// tools/letter_capture/handwriting_capture.html and merged in by hand). Cards without
// variantOf are ignored, so this is a no-op for every letter that has no variants captured.
function buildVariantIndex(lettersByLabel) {
  const index = new Map();
  for (const card of lettersByLabel.values()) {
    if (!card.variantOf) continue;
    let entry = index.get(card.variantOf);
    if (!entry) {
      entry = { first: {}, last: {}, middle: {} };
      index.set(card.variantOf, entry);
    }
    if (card.position === "first") entry.first[card.exitType] = card;
    else if (card.position === "last") entry.last[card.entryType] = card;
    else if (card.position === "middle") entry.middle[`${card.entryType}_${card.exitType}`] = card;
  }
  return index;
}

// A dual-nature letter (о, ю) has no fixed connection shape of its own — resolves to
// whichever captured variant matches its position in the word and its neighbors' own height
// classification. entryType mirrors whether the PRECEDING letter is one of the fixed
// upper-exit letters (EXIT_LINE_OVERRIDES) — confirmed against real captures: "when о has an
// upper entry connector, that means the previous letter's own upper exit connection is being
// used." Returns null whenever the needed variant hasn't been captured (or this isn't a
// dual-nature letter at all), letting the caller fall back to the plain isolated card and
// the ordinary connector system exactly as before.
//
// A following letter that is itself dual-nature has no fixed height classification to hand
// off to (entryHeightGroup returns null for it), so it gets its own "dual" exit bucket tried
// first — captured because handing off into another о/ю draws differently than handing off
// into a genuine upper-entry letter like к, even though both currently fall under
// simplifyToUpperLower's "upper" default. Falls through to the ordinary upper/lower bucket
// when no dedicated dual-exit card has been captured for this entryType.
function resolveVariant(variantIndex, label, position, prevLabel, nextLabel) {
  const variants = variantIndex.get(label);
  if (!variants) return null;

  const entryType = prevLabel ? (EXIT_LINE_OVERRIDES[prevLabel] ? "upper" : "lower") : null;
  const nextIsDual = nextLabel ? DUAL_NATURE_LETTERS.has(nextLabel) : false;
  const exitType = nextLabel ? simplifyToUpperLower(entryHeightGroup(nextLabel)) : null;

  if (position === "first") {
    if (nextIsDual && variants.first.dual) return variants.first.dual;
    return (exitType && variants.first[exitType]) || null;
  }
  if (position === "last") return (entryType && variants.last[entryType]) || null;
  if (position === "middle") {
    if (!entryType) return null;
    if (nextIsDual) {
      const dualVariant = variants.middle[`${entryType}_dual`];
      if (dualVariant) return dualVariant;
    }
    if (!exitType) return null;
    return variants.middle[`${entryType}_${exitType}`] || null;
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
// or a bridge whose angle doesn't continue the pen's existing direction). The artist accepts
// full responsibility for capturing connectors and letters consistently enough that snapping
// them together directly looks right — if "бб" drifts taller with each repetition, the fix
// is a better-matched capture of the connector/letter pair, not a code-side correction.
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
      const entryConnector = usedVariant ? undefined : findEntryConnector(connectorsByKey, info.entryLine, ch);

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
    prev = {
      exitLine: info.exitLine,
      exitPointWorld: [info.exitPoint[0] + dx, info.exitPoint[1] + dy],
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
