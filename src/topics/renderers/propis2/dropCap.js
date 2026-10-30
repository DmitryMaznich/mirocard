// The printed letter of a row (a «буквица»): one capital of the deck's alphabet in a frame that stands on the BASELINE of its row,
// so a pupil sees which letter the elements and words of the row belong to. In the page margin when the page has one, else at the start
// of its own row (the margin is the adult's choice and is never switched on for a letter). Owner's rules (2026-10-30): the frame as tall as a
// written capital on the narrow ruling (8 mm: from the wide row's dashed top line to the baseline), square, in the page margin; Nunito
// Bold, one colour (the app's teal, not the pupil's ink blue). Drawn by PrintPageView (the row line carries it as the flag `#bИ`).
import { topicAlphabet } from "./alphabet.js";
import { mmToNativeUnits } from "../propis/propisRuling.js";

export const DROP_FRAME_MM = 8;
export const DROP_CAP_MM = 4.4; // height of the capital
export const DROP_MAX_WIDTH = 0.74; // a letter is at most this part of the frame wide (Ж Ш Щ Ю get narrower)
export const DROP_STROKE_MM = 0.45;
export const DROP_RADIUS_MM = 2.2;
export const DROP_COLOR = "#2a6b60";
export const DROP_FILL = "#e8f4f1";
// Without a margin the frame stands at the left or the right end of its own row and the row gives up this many slant cells (2.5 mm each on the
// narrow ruling) for it: the frame (8 mm) and 4.5 mm of air. At the left the ink starts that much further in (`#iN`), at the right the row ends
// that much earlier (`#wN`). The rows without a letter are written edge to edge as everywhere else. With a margin the letter stands in it.
export const DROP_ROW_INDENT_CELLS = 5;
const NUNITO_CAP_HEIGHT = 0.705; // em

// Nunito Bold (700) advance widths of the Cyrillic capitals, 1/1000 em (public/fonts/pdf/glyphs.json): the letter is fitted into its frame
export const DROP_ADVANCE = {"А": 744, "Б": 673, "В": 688, "Г": 559, "Д": 799, "Е": 597, "Ж": 1014, "З": 635, "И": 748, "Й": 748, "К": 675, "Л": 752, "М": 868, "Н": 773, "О": 785, "П": 766, "Р": 652, "С": 680, "Т": 621, "У": 661, "Ф": 885, "Х": 672, "Ц": 812, "Ч": 696, "Ш": 1070, "Щ": 1115, "Ъ": 807, "Ы": 901, "Ь": 673, "Э": 680, "Ю": 1047, "Я": 688, "Ё": 597, "Ў": 661};

// Size of the letter inside its frame, in native units of the page: the capital's height, or less when the letter is wide
export function dropGeometry(letter) {
  const frame = mmToNativeUnits(DROP_FRAME_MM);
  const cap = mmToNativeUnits(DROP_CAP_MM);
  let fontSize = cap / NUNITO_CAP_HEIGHT;
  const adv = (DROP_ADVANCE[letter] ?? 700) / 1000;
  if (adv * fontSize > frame * DROP_MAX_WIDTH) fontSize = (frame * DROP_MAX_WIDTH) / adv;
  return { frame, fontSize, capHeight: fontSize * NUNITO_CAP_HEIGHT, stroke: mmToNativeUnits(DROP_STROKE_MM), radius: mmToNativeUnits(DROP_RADIUS_MM) };
}

// The capitals a deck offers for a row: its own alphabet's letters that have a capital (Ъ Ы Ь have none in the Russian one)
export function dropLetters(topicRecord, glyphMap) {
  const alphabet = topicAlphabet(topicRecord, glyphMap);
  return alphabet.lower.filter((ch) => !alphabet.noCapital.has(ch)).map((ch) => ch.toUpperCase());
}

// The letter a row hints at: the first letter of its text (a word, a letter, «и и и и», an element named for its letter: «И-лев», «э-дуга»),
// as a capital of the alphabet
export function suggestDrop(row, letters) {
  const text = String(row?.text ?? "").trim();
  if (!text) return null;
  const first = text[0].toUpperCase();
  return letters.includes(first) ? first : null;
}

// A row's printed letter as the engine's line flag (the first line of the row carries it): `#b` + letter at the left end, `#B` + letter at the right
export function dropFlag(letter, side = "left") {
  return letter ? `#${side === "right" ? "B" : "b"}${letter}` : "";
}
