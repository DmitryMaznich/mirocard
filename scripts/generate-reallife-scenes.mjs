/**
 * generate-reallife-scenes.mjs
 * SPIKE script — generates full illustrated comparison scenes (both children
 * in one frame, item piles with an exact count on each side) for the
 * "Сравни в жизни" mode (CompareRealLife.jsx), as an alternative to the
 * hand-drawn SVG diorama concept. One PNG per scene, 3:2 (matches the real
 * .reallife-scene box's ~100/64 aspect ratio, not a wide 16:9 — see
 * comparison.css), saved to scripts/.cache/reallife-scenes/ — NOT wired into
 * the app yet.
 *
 * Requires GEMINI_API_KEY (.env/.env.local).
 *
 * Usage:
 *   node scripts/generate-reallife-scenes.mjs          # generate all
 *   node scripts/generate-reallife-scenes.mjs --skip   # reuse cached PNGs
 *   node scripts/generate-reallife-scenes.mjs apples_petya_masha  # one scene by id
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "scripts", ".cache", "reallife-scenes");

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const sep = l.indexOf("=");
    if (sep <= 0) continue;
    const key = l.slice(0, sep).trim();
    let val = l.slice(sep + 1).trim();
    if (/^['"].*['"]$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env");
loadEnv("C:/Users/dmazn/Projects/Mirocard/.env.local");

const API_KEY  = process.env.GEMINI_API_KEY;
const MODEL    = process.env.GEMINI_MODEL || "gemini-3.1-flash-image-preview";
const cliArgs  = process.argv.slice(2);
const SKIP     = cliArgs.includes("--skip");
const ONLY_ID  = cliArgs.find((a) => !a.startsWith("--"));

if (!API_KEY) { console.error("GEMINI_API_KEY not found — set it in .env (see .env.example)."); process.exit(1); }
console.log(`Model: ${MODEL}\n`);

fs.mkdirSync(CACHE_DIR, { recursive: true });

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { imageConfig: { aspectRatio: "3:2", imageSize: "2K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const parts   = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData || p?.inline_data);
  const inline  = imgPart?.inlineData ?? imgPart?.inline_data;
  if (!inline?.data) throw new Error("No image in response");
  return Buffer.from(inline.data, "base64");
}

// ── Style bible, shared by every scene (same wording as the prompt sheet
// handed to the user, so a manually-run and a script-run image match) ──────
const STYLE = `Flat vector children's-book illustration, thick clean outlines, warm saturated
storybook color palette, soft flat shading (no photorealistic gradients or 3D
render look), simple friendly character design like a modern European picture
book, single flat-perspective scene, 3:2 landscape composition (slightly taller
and more square than a wide 16:9 frame — do not leave empty margins at the
sides), no text, no letters, no logos, no watermark anywhere in the image, high
resolution.`;

// ── Round 1: 10 discrete-object scenes — 2 per item, matching the name pairs
// engine.js used to keep in REAL_LIFE_SCENARIOS before this bank replaced it ─
const SCENES = [
  {
    id: "apples_petya_masha", item: "яблок", left: 3, right: 7,
    nameA: "Пети", nameANom: "Петя", genderA: "boy", nameB: "Маши", nameBNom: "Маша", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen with a built-in wood counter whose solid front panel
reaches all the way down to the floor, like a closed cabinet base (no legs, not
floating, no sink, no faucet, no stove — just a clear flat counter surface on top
of a solid base), a window with a small potted plant, soft afternoon light. Two
children stand behind the counter, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 6 years old, brown hair, wearing a blue
sweater, standing next to a ceramic bowl with exactly 3 red apples in it.

Right third of the frame: a girl, about 6 years old, brown hair in a ponytail,
wearing a pink dress, standing next to a bigger ceramic bowl with exactly 7 red
and orange apples in it.

Both children and both bowls must be clearly visible in one single frame. Count
must be exact: 3 apples on the left, 7 apples on the right — arrange the apples so
they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "apples_lyosha_ksyusha", item: "яблок", left: 6, right: 2,
    nameA: "Лёши", nameANom: "Лёша", genderA: "boy", nameB: "Ксюши", nameBNom: "Ксюша", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of cozy home kitchen, a built-in wood counter whose solid
front panel reaches all the way down to the floor, like a closed cabinet base
(no legs, not floating, no sink, no faucet, no stove), a window with morning
light and a hanging plant. Two children stand behind the counter, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 7 years old, dark blond hair, wearing a
teal shirt, standing next to a wicker basket with exactly 6 green and red apples
in it.

Right third of the frame: a girl, about 5 years old, light brown hair with a
small braid, wearing a yellow dress, standing next to a small wicker basket with
exactly 2 red apples in it.

Both children and both baskets must be clearly visible in one single frame. Count
must be exact: 6 apples on the left, 2 apples on the right — arrange the apples so
they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "candies_kostya_anya", item: "конфет", left: 8, right: 3,
    nameA: "Кости", nameANom: "Костя", genderA: "boy", nameB: "Ани", nameBNom: "Аня", genderB: "girl",
    prompt: `${STYLE}

Scene: a cheerful birthday-party living room, pastel bunting flags strung along
the top of the wall, a cream-colored table with a long tablecloth that reaches
all the way down to the floor, hiding the legs completely (the table must not
look like it is floating). Two children stand behind the table, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 6 years old, short dark hair, wearing a
mustard-yellow shirt, standing next to a glass jar with exactly 8 individually
wrapped candies (twist-wrapped, different bright colors) inside.

Right third of the frame: a girl, about 6 years old, dark hair in two small
pigtails, wearing a green dress, standing next to a smaller glass jar with exactly
3 individually wrapped candies inside.

Both children and both jars must be clearly visible in one single frame. Count
must be exact: 8 candies on the left, 3 candies on the right — arrange the candies
so they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "candies_roma_nastya", item: "конфет", left: 2, right: 6,
    nameA: "Ромы", nameANom: "Рома", genderA: "boy", nameB: "Насти", nameBNom: "Настя", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of birthday-party living room, colorful bunting flags, a
warm wooden sideboard instead of a table, with a solid front panel that reaches
all the way down to the floor, like a closed cabinet base (no legs, not
floating). Two children stand behind the sideboard, side by side, facing the
viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 5 years old, curly red-brown hair, wearing
an orange t-shirt, standing next to a small glass jar with exactly 2 wrapped
candies inside.

Right third of the frame: a girl, about 7 years old, straight blonde hair with a
headband, wearing a coral dress, standing next to a bigger glass jar with exactly
6 wrapped candies (different bright colors) inside.

Both children and both jars must be clearly visible in one single frame. Count
must be exact: 2 candies on the left, 6 candies on the right — arrange the candies
so they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "cars_vanya_sonya", item: "машинок", left: 2, right: 5,
    nameA: "Вани", nameANom: "Ваня", genderA: "boy", nameB: "Сони", nameBNom: "Соня", genderB: "girl",
    prompt: `${STYLE}

Scene: a playroom with a round rug that has a simple road/track pattern woven
into it, a small wooden shelf with toy boxes in the background, soft daylight.
Two children sit or kneel on the rug, side by side, facing the viewer, sharing
the same floor line and light.

Left third of the frame: a boy, about 6 years old, short brown hair, wearing a
green shirt, with exactly 2 colorful toy cars parked in front of him on the rug.

Right third of the frame: a girl, about 6 years old, dark hair in a bob cut,
wearing a blue overall dress, with exactly 5 colorful toy cars parked in front of
her on the rug.

Both children and both groups of toy cars must be clearly visible in one single
frame. Count must be exact: 2 toy cars on the left, 5 toy cars on the right —
arrange the cars so they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "cars_tima_vika", item: "машинок", left: 7, right: 3,
    nameA: "Тимы", nameANom: "Тима", genderA: "boy", nameB: "Вики", nameBNom: "Вика", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of playroom, a round rug with a road pattern, a window
with soft light, toy boxes stacked in a corner. Two children sit or kneel on the
rug, side by side, facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 7 years old, sandy blond hair, wearing a
red-and-white striped shirt, with exactly 7 small colorful toy cars lined up in
front of him on the rug.

Right third of the frame: a girl, about 5 years old, light brown hair in two
short pigtails, wearing a purple dress, with exactly 3 small colorful toy cars in
front of her on the rug.

Both children and both groups of toy cars must be clearly visible in one single
frame. Count must be exact: 7 toy cars on the left, 3 toy cars on the right —
arrange the cars so they are individually countable, not overlapping into a blob.`,
  },
  {
    id: "balloons_dima_kira", item: "шариков", left: 5, right: 2,
    nameA: "Димы", nameANom: "Дима", genderA: "boy", nameB: "Киры", nameBNom: "Кира", genderB: "girl",
    prompt: `${STYLE}

Scene: a sunny backyard with a short, evenly mowed lawn (flat green grass, not
tall or wild grass blades), a low wooden fence in the background that reaches
about waist height on the children, a clear blue sky with a few soft clouds. Two
children stand fully upright on top of the grass, their whole bodies visible
from feet to head, feet planted clearly on the ground (not sunk into the grass),
side by side, facing the viewer, sharing the same ground line and light.

Left third of the frame: a boy, about 6 years old, dark hair, wearing an orange
t-shirt, holding a bunch of exactly 5 round balloons on strings gathered together
above his hand.

Right third of the frame: a girl, about 6 years old, brown hair in a high
ponytail, wearing a yellow sundress, holding a smaller bunch of exactly 2 round
balloons on strings above her hand.

Both children and both balloon bunches must be clearly visible in one single
frame. Count must be exact: 5 balloons on the left, 2 balloons on the right —
arrange the balloons so they are individually countable, not overlapping into a
blob, each a different bright color.`,
  },
  {
    id: "balloons_seva_polina", item: "шариков", left: 3, right: 8,
    nameA: "Севы", nameANom: "Сева", genderA: "boy", nameB: "Полины", nameBNom: "Полина", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of sunny backyard, a short evenly mowed lawn (flat green
grass, not tall or wild grass blades), a wooden fence about waist height on the
children with a small string of party flags, a clear sky. Two children stand
fully upright on top of the grass, their whole bodies visible from feet to head,
feet planted clearly on the ground (not sunk into the grass), side by side,
facing the viewer, sharing the same ground line and light.

Left third of the frame: a boy, about 5 years old, short dark blond hair,
wearing a teal t-shirt, holding a bunch of exactly 3 round balloons on strings
above his hand.

Right third of the frame: a girl, about 7 years old, dark hair with a flower
hair clip, wearing a pink sundress, holding a big bunch of exactly 8 round
balloons on strings above her hand.

Both children and both balloon bunches must be clearly visible in one single
frame. Count must be exact: 3 balloons on the left, 8 balloons on the right —
arrange the balloons so they are individually countable, not overlapping into a
blob, each a different bright color.`,
  },
  {
    id: "pencils_egor_ira", item: "карандашей", left: 4, right: 9,
    nameA: "Егора", nameANom: "Егор", genderA: "boy", nameB: "Иры", nameBNom: "Ира", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy study corner with a wooden desk whose solid front panel reaches
all the way down to the floor, like a closed cabinet base (no legs, not
floating), a window with a small potted plant, a shelf with a few books above
the desk, soft daylight. Two children stand behind the desk, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 7 years old, dark red hair, wearing a
coral t-shirt, standing next to a small cup holding exactly 4 colored pencils,
tips pointing up, fanned out slightly.

Right third of the frame: a girl, about 6 years old, brown hair in a ponytail,
wearing a blue dress, standing next to a bigger cup holding exactly 9 colored
pencils, tips pointing up, fanned out slightly.

Both children and both pencil cups must be clearly visible in one single frame.
Count must be exact: 4 pencils on the left, 9 pencils on the right — arrange the
pencils so each one is individually countable, not overlapping into a blob, each
pencil a different color.`,
  },
  {
    id: "pencils_maxim_liza", item: "карандашей", left: 6, right: 2,
    nameA: "Максима", nameANom: "Максим", genderA: "boy", nameB: "Лизы", nameBNom: "Лиза", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of study corner, a wooden desk whose solid front panel
reaches all the way down to the floor, like a closed cabinet base (no legs, not
floating), a sheet of paper lying on it, a window with soft afternoon light. Two
children stand behind the desk, side by side, facing the viewer, sharing the same
floor line and light.

Left third of the frame: a boy, about 6 years old, light brown hair, wearing a
navy-blue shirt, standing next to a cup holding exactly 6 colored pencils, tips
pointing up, fanned out slightly.

Right third of the frame: a girl, about 5 years old, blonde hair with a small
bow, wearing a lilac dress, standing next to a small cup holding exactly 2
colored pencils, tips pointing up.

Both children and both pencil cups must be clearly visible in one single frame.
Count must be exact: 6 pencils on the left, 2 pencils on the right — arrange the
pencils so each one is individually countable, not overlapping into a blob, each
pencil a different color.`,
  },

  // ── Round 2: continuous-amount scenes (containerPhrase set) — compare how
  // much is inside a container instead of counting discrete objects. left/
  // right are still just a relative magnitude (used for correct/incorrect),
  // not a literal count; the prompt below expresses each as a fill level.
  {
    id: "water_artem_dasha", item: "воды", left: 3, right: 7, containerPhrase: "в стакане",
    nameA: "Артёма", nameANom: "Артём", genderA: "boy", nameB: "Даши", nameBNom: "Даша", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen with a built-in wood counter whose solid front panel
reaches all the way down to the floor, like a closed cabinet base (no legs, not
floating, no sink, no faucet, no stove — just a clear flat counter surface on top
of a solid base), a window with soft daylight and a small potted plant. Two
children stand behind the counter, side by side, facing the viewer, sharing the
same floor line and light.

Left third of the frame: a boy, about 6 years old, brown hair, wearing a green
t-shirt, standing next to a tall clear glass on the counter. The glass is filled
with water to only about 30% of its height — a shallow layer of water at the
bottom, the rest of the glass empty and clearly visible.

Right third of the frame: a girl, about 6 years old, dark hair in a ponytail,
wearing a coral dress, standing next to a tall clear glass on the counter,
identical in shape and size to the boy's glass. This glass is filled with water
to about 70% of its height — clearly much more full than the other glass, but
not all the way to the brim.

Both children and both glasses must be clearly visible in one single frame. The
two glasses must be the exact same shape and size — only the water level differs.
The difference in water level between the two glasses must be obvious at a
glance: one clearly low, one clearly high.`,
  },
  {
    id: "water_grisha_lyuba", item: "воды", left: 6, right: 2, containerPhrase: "в стакане",
    nameA: "Гриши", nameANom: "Гриша", genderA: "boy", nameB: "Любы", nameBNom: "Люба", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of cozy home kitchen, a built-in wood counter whose solid
front panel reaches all the way down to the floor, like a closed cabinet base
(no legs, not floating), a window with morning light. Two children stand behind
the counter, side by side, facing the viewer, sharing the same floor line and
light.

Left third of the frame: a boy, about 7 years old, dark blond hair, wearing a
blue-grey shirt, standing next to a tall clear glass on the counter. The glass is
filled with water to about 60% of its height — clearly more than half full.

Right third of the frame: a girl, about 5 years old, light brown hair with a
small bow, wearing a yellow dress, standing next to a tall clear glass on the
counter, identical in shape and size to the boy's glass. This glass is filled
with water to only about 20% of its height — a thin layer at the bottom, clearly
much less than the other glass.

Both children and both glasses must be clearly visible in one single frame. The
two glasses must be the exact same shape and size — only the water level
differs. The difference in water level between the two glasses must be obvious
at a glance.`,
  },
  {
    id: "porridge_matvey_vera", item: "каши", left: 2, right: 8, containerPhrase: "в тарелке",
    nameA: "Матвея", nameANom: "Матвей", genderA: "boy", nameB: "Веры", nameBNom: "Вера", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen breakfast table with a solid wooden tabletop and a
front panel that reaches all the way down to the floor, like a closed cabinet
base (no legs, not floating), a window with soft morning light, a small potted
plant. Two children stand behind the table, side by side, facing the viewer,
sharing the same floor line and light.

Left third of the frame: a boy, about 6 years old, dark hair, wearing an orange
shirt, standing next to a round bowl on the table. The bowl holds a small amount
of porridge — only about 20% of the bowl is filled, a small pale-yellow mound in
the center of an otherwise empty bowl. A spoon rests in the bowl, its handle
leaning against the rim.

Right third of the frame: a girl, about 6 years old, brown hair in two braids,
wearing a teal dress, standing next to a round bowl on the table, identical in
shape and size to the boy's bowl. This bowl is filled with porridge to about 80%
of its capacity — nearly full, a smooth pale-yellow surface close to the rim,
with a small pat of butter on top. A spoon rests in this bowl too, its handle
leaning against the rim, matching the boy's spoon in style.

Both children and both bowls must be clearly visible in one single frame, each
bowl with its own spoon. The two bowls must be the exact same shape and size —
only the amount of porridge differs. The difference in fill level between the
two bowls must be obvious at a glance: one clearly almost empty, one clearly
almost full.`,
  },
  {
    id: "porridge_styopa_olya", item: "каши", left: 7, right: 4, containerPhrase: "в тарелке",
    nameA: "Стёпы", nameANom: "Стёпа", genderA: "boy", nameB: "Оли", nameBNom: "Оля", genderB: "girl",
    prompt: `${STYLE}

Scene: the same style of cozy kitchen breakfast table, a solid wooden tabletop
with a front panel reaching all the way down to the floor, like a closed cabinet
base (no legs, not floating), a window with soft daylight. Two children stand
behind the table, side by side, facing the viewer, sharing the same floor line
and light.

Left third of the frame: a boy, about 7 years old, sandy blond hair, wearing a
red shirt, standing next to a round bowl on the table. The bowl is filled with
porridge to about 70% of its capacity — clearly more than half full, a smooth
pale-yellow surface. A spoon rests in the bowl, its handle leaning against the
rim.

Right third of the frame: a girl, about 5 years old, dark hair with a small
flower clip, wearing a pink dress, standing next to a round bowl on the table,
identical in shape and size to the boy's bowl. This bowl is filled with porridge
to about 40% of its capacity — clearly less than half full. A spoon rests in
this bowl too, its handle leaning against the rim, matching the boy's spoon in
style.

Both children and both bowls must be clearly visible in one single frame, each
bowl with its own spoon. The two bowls must be the exact same shape and size —
only the amount of porridge differs. The difference in fill level between the
two bowls must be obvious at a glance.`,
  },

  // ── Round 3: one genuinely equal scene per item (new name pairs, not
  // reused from rounds 1-2) — every scene so far has left !== right, so
  // "Поровну" was never actually the correct answer to tap, only ever a
  // distractor. left === right on all seven of these.
  {
    id: "apples_kirill_alisa", item: "яблок", left: 5, right: 5,
    nameA: "Кирилла", nameANom: "Кирилл", genderA: "boy", nameB: "Алисы", nameBNom: "Алиса", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen with a built-in wood counter whose solid front panel
reaches all the way down to the floor, like a closed cabinet base (no legs, not
floating, no sink, no faucet, no stove — just a clear flat counter surface on top
of a solid base), a window with soft daylight and a small potted plant. Two
children stand behind the counter, side by side, facing the viewer, sharing the
same floor line and light.

Left third of the frame: a boy, about 6 years old, light brown hair, wearing a
purple t-shirt, standing next to a ceramic bowl with exactly 5 red apples in it.

Right third of the frame: a girl, about 6 years old, dark hair in two short
pigtails, wearing a mint-green dress, standing next to a ceramic bowl on the
counter, identical in size and shape to the boy's bowl. This bowl also holds
exactly 5 apples, matching the boy's bowl in color mix and arrangement style.

Both children and both bowls must be clearly visible in one single frame. Count
must be exact and equal: 5 apples on the left, 5 apples on the right — arrange
each pile so the apples are individually countable, not overlapping into a blob,
and so the two piles visibly look the same size at a glance.`,
  },
  {
    id: "candies_misha_yulya", item: "конфет", left: 6, right: 6,
    nameA: "Миши", nameANom: "Миша", genderA: "boy", nameB: "Юли", nameBNom: "Юля", genderB: "girl",
    prompt: `${STYLE}

Scene: a cheerful birthday-party living room, pastel bunting flags strung along
the top of the wall, a cream-colored table with a long tablecloth that reaches
all the way down to the floor, hiding the legs completely (the table must not
look like it is floating). Two children stand behind the table, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 6 years old, curly dark hair, wearing a
sky-blue shirt, standing next to a glass jar with exactly 6 individually
wrapped candies (twist-wrapped, different bright colors) inside.

Right third of the frame: a girl, about 5 years old, blonde hair with a
headband, wearing a coral dress, standing next to a glass jar on the table,
identical in size and shape to the boy's jar. This jar also holds exactly 6
wrapped candies, matching the boy's jar in color mix and arrangement style.

Both children and both jars must be clearly visible in one single frame. Count
must be exact and equal: 6 candies on the left, 6 candies on the right —
arrange each pile so the candies are individually countable, not overlapping
into a blob, and so the two piles visibly look the same size at a glance.`,
  },
  {
    id: "cars_danil_zlata", item: "машинок", left: 4, right: 4,
    nameA: "Данила", nameANom: "Данил", genderA: "boy", nameB: "Златы", nameBNom: "Злата", genderB: "girl",
    prompt: `${STYLE}

Scene: a playroom with a round rug that has a simple road/track pattern woven
into it, a small wooden shelf with toy boxes in the background, soft daylight.
Two children sit or kneel on the rug, side by side, facing the viewer, sharing
the same floor line and light.

Left third of the frame: a boy, about 6 years old, short dark hair, wearing a
yellow shirt, with exactly 4 colorful toy cars parked in front of him on the
rug.

Right third of the frame: a girl, about 6 years old, brown hair in a high
ponytail, wearing a purple overall dress, with exactly 4 colorful toy cars
parked in front of her on the rug, matching the boy's cars in color mix and
arrangement style.

Both children and both groups of toy cars must be clearly visible in one single
frame. Count must be exact and equal: 4 toy cars on the left, 4 toy cars on the
right — arrange each group so the cars are individually countable, not
overlapping into a blob, and so the two groups visibly look the same size at a
glance.`,
  },
  {
    id: "balloons_rodion_alina", item: "шариков", left: 5, right: 5,
    nameA: "Родиона", nameANom: "Родион", genderA: "boy", nameB: "Алины", nameBNom: "Алина", genderB: "girl",
    prompt: `${STYLE}

Scene: a sunny backyard with a short, evenly mowed lawn (flat green grass, not
tall or wild grass blades), a low wooden fence in the background that reaches
about waist height on the children, a clear blue sky with a few soft clouds. Two
children stand fully upright on top of the grass, their whole bodies visible
from feet to head, feet planted clearly on the ground (not sunk into the grass),
side by side, facing the viewer, sharing the same ground line and light.

Left third of the frame: a boy, about 6 years old, dark blond hair, wearing a
red t-shirt, holding a bunch of exactly 5 round balloons on strings gathered
together above his hand.

Right third of the frame: a girl, about 6 years old, brown hair in two braids,
wearing a teal sundress, holding a bunch of exactly 5 round balloons on strings
above her hand, matching the boy's bunch in size and color mix.

Both children and both balloon bunches must be clearly visible in one single
frame. Count must be exact and equal: 5 balloons on the left, 5 balloons on the
right — arrange each bunch so the balloons are individually countable, not
overlapping into a blob, each a different bright color, and so the two bunches
visibly look the same size at a glance.`,
  },
  {
    id: "pencils_nikita_sofia", item: "карандашей", left: 5, right: 5,
    nameA: "Никиты", nameANom: "Никита", genderA: "boy", nameB: "Софии", nameBNom: "София", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy study corner with a wooden desk whose solid front panel reaches
all the way down to the floor, like a closed cabinet base (no legs, not
floating), a window with a small potted plant, a shelf with a few books above
the desk, soft daylight. Two children stand behind the desk, side by side,
facing the viewer, sharing the same floor line and light.

Left third of the frame: a boy, about 7 years old, short brown hair, wearing a
teal t-shirt, standing next to a cup holding exactly 5 colored pencils, tips
pointing up, fanned out slightly.

Right third of the frame: a girl, about 6 years old, dark hair in a single
braid, wearing a yellow dress, standing next to a cup on the desk, identical in
size and shape to the boy's cup. This cup also holds exactly 5 colored pencils,
matching the boy's cup in color mix and arrangement style.

Both children and both pencil cups must be clearly visible in one single frame.
Count must be exact and equal: 5 pencils on the left, 5 pencils on the right —
arrange each cup so the pencils are individually countable, not overlapping
into a blob, each pencil a different color, and so the two cups visibly look
the same at a glance.`,
  },
  {
    id: "water_bogdan_marina", item: "воды", left: 5, right: 5, containerPhrase: "в стакане",
    nameA: "Богдана", nameANom: "Богдан", genderA: "boy", nameB: "Марины", nameBNom: "Марина", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen with a built-in wood counter whose solid front panel
reaches all the way down to the floor, like a closed cabinet base (no legs, not
floating, no sink, no faucet, no stove — just a clear flat counter surface on top
of a solid base), a window with soft daylight and a small potted plant. Two
children stand behind the counter, side by side, facing the viewer, sharing the
same floor line and light.

Left third of the frame: a boy, about 6 years old, dark hair, wearing a navy
t-shirt, standing next to a tall clear glass on the counter. The glass is filled
with water to about 50% of its height — exactly half full.

Right third of the frame: a girl, about 6 years old, light brown hair in a
ponytail, wearing a peach dress, standing next to a tall clear glass on the
counter, identical in shape and size to the boy's glass. This glass is also
filled with water to about 50% of its height, matching the boy's glass exactly.

Both children and both glasses must be clearly visible in one single frame. The
two glasses must be the exact same shape and size, filled to the exact same
water level — the two water levels must visibly line up and match at a glance,
neither one higher than the other.`,
  },
  {
    id: "porridge_ilya_milana", item: "каши", left: 5, right: 5, containerPhrase: "в тарелке",
    nameA: "Ильи", nameANom: "Илья", genderA: "boy", nameB: "Миланы", nameBNom: "Милана", genderB: "girl",
    prompt: `${STYLE}

Scene: a cozy home kitchen breakfast table with a solid wooden tabletop and a
front panel that reaches all the way down to the floor, like a closed cabinet
base (no legs, not floating), a window with soft morning light, a small potted
plant. Two children stand behind the table, side by side, facing the viewer,
sharing the same floor line and light.

Left third of the frame: a boy, about 6 years old, sandy hair, wearing a green
shirt, standing next to a round bowl on the table. The bowl is filled with
porridge to about 50% of its capacity — exactly half full, a smooth pale-yellow
surface. A spoon rests in the bowl, its handle leaning against the rim.

Right third of the frame: a girl, about 6 years old, dark hair in a bob cut,
wearing a lilac dress, standing next to a round bowl on the table, identical in
shape and size to the boy's bowl. This bowl is also filled with porridge to
about 50% of its capacity, matching the boy's bowl exactly. A spoon rests in
this bowl too, its handle leaning against the rim, matching the boy's spoon in
style.

Both children and both bowls must be clearly visible in one single frame, each
bowl with its own spoon. The two bowls must be the exact same shape and size,
filled to the exact same level — the two fill levels must visibly line up and
match at a glance, neither one fuller than the other.`,
  },
];

const targets = ONLY_ID ? SCENES.filter((s) => s.id === ONLY_ID) : SCENES;
if (!targets.length) { console.error(`No scene matches id "${ONLY_ID}"`); process.exit(1); }

for (const scene of targets) {
  const outPath = path.join(CACHE_DIR, `${scene.id}.png`);
  if (SKIP && fs.existsSync(outPath)) {
    console.log(`  ↩ ${scene.id} (cached)`);
    continue;
  }
  console.log(`▶ ${scene.id} (${scene.item}: ${scene.left} vs ${scene.right})…`);
  try {
    const buf = await callGemini(scene.prompt);
    const png = await sharp(buf).png().toBuffer();
    fs.writeFileSync(outPath, png);
    console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
  } catch (err) {
    console.error(`  ✗ ${scene.id}: ${err.message}`);
  }
}

// ── Build the JS module CompareRealLife.jsx imports ────────────────────
// Only runs when every scene in SCENES has a cached PNG — a partial module
// (missing scenes) would silently shrink the answer bank at runtime instead
// of failing loudly, so bail out instead of writing one.
const OUT_MODULE = path.join(ROOT, "src", "topics", "renderers", "comparison", "realLifeScenes.js");
const missing = SCENES.filter((s) => !fs.existsSync(path.join(CACHE_DIR, `${s.id}.png`)));
if (missing.length) {
  console.log(`\nSkipping module write — missing PNGs for: ${missing.map((s) => s.id).join(", ")}`);
  process.exit(0);
}

console.log("\nBuilding realLifeScenes.js…");
const scenesOut = [];
for (const scene of SCENES) {
  const raw = fs.readFileSync(path.join(CACHE_DIR, `${scene.id}.png`));
  // 900px-wide JPEG keeps each scene ~50-90KB (vs. several MB straight out of
  // the API) — plenty for the ~360px on-screen box, and small enough for 10
  // of them to embed as base64 in one module without bloating the deck zip.
  const jpeg = await sharp(raw).resize({ width: 900 }).jpeg({ quality: 82 }).toBuffer();
  scenesOut.push({
    id: scene.id, item: scene.item, left: scene.left, right: scene.right,
    nameA: scene.nameA, nameANom: scene.nameANom, genderA: scene.genderA,
    nameB: scene.nameB, nameBNom: scene.nameBNom, genderB: scene.genderB,
    ...(scene.containerPhrase ? { containerPhrase: scene.containerPhrase } : {}),
    image: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  });
}

const moduleSrc = `// Generated by scripts/generate-reallife-scenes.mjs — do not edit by hand.
// A fixed bank of pre-illustrated comparison scenes for "Сравни в жизни"
// (CompareRealLife.jsx): each entry is one full scene (both children, both
// item piles, exact counts baked into the image) rather than a procedurally
// scattered pile drawn at runtime. engine.js's generateRealLifeTask picks
// from this bank instead of generating arbitrary left/right numbers.
export const REAL_LIFE_SCENES = ${JSON.stringify(scenesOut, null, 2)};
`;
fs.writeFileSync(OUT_MODULE, moduleSrc);
console.log(`✓ Wrote ${path.relative(ROOT, OUT_MODULE)}`);

console.log("\nDone.");
