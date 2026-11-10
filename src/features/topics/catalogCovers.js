import printLetters from "../../topics/renderers/print_letters/media/avatar.svg?raw";
import symmetryDraw from "../../../tools/symmetry_draw/media/avatar.svg?raw";
import drawing from "../../../tools/drawing/media/avatar.svg?raw";
import magneticAlphabet from "../../../tools/magnetic_alphabet/media/avatar.svg?raw";
import learnSlovene from "../../../tools/learn_slovene/media/avatar.svg?raw";

// Covers for catalog rows of topics that are not installed yet (topic UI
// preview only). Without them several ZIP topics showed the same generic
// flashcards picture in «Добавить тему». Each is the deck's own avatar, so the
// row looks the same before and after installing. Topics whose cover is
// already built in (builtinAssets) are not repeated here.
const COVERS = {
  print_letters: printLetters,
  symmetry_draw: symmetryDraw,
  drawing,
  magnetic_alphabet: magneticAlphabet,
  learn_slovene: learnSlovene,
};

// propis2 and its Latin deck use the old «Прописи» cover kept in builtinAssets.
const BUILTIN_PATHS = { propis2: "media/avatar_propis.svg", propis2_lang: "media/avatar_propis.svg" };

export const CATALOG_COVER_PATH = "media/catalog_cover.svg";

export function catalogCoverPath(topicId) {
  if (COVERS[topicId]) return CATALOG_COVER_PATH;
  return BUILTIN_PATHS[topicId] ?? null;
}

export function catalogCoverUrl(topicId) {
  const svg = COVERS[topicId];
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
