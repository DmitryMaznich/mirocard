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

  // ── Round 4: structural/inherent-part comparisons — count a part that's
  // built into the thing itself (legs, wheels, windows...), not an item
  // someone was handed. A deliberately different comparison axis from
  // rounds 1-3 (all "how many X is a child holding/served") — requested
  // live after "У кого больше ног — человек и собака" as the seed example.
  {
    id: "legs_boy_dog", item: "ног", left: 2, right: 4,
    nameA: "мальчика", nameANom: "Мальчик", genderA: "boy",
    nameB: "собаки", nameBNom: "Собака", genderB: "animal",
    prompt: `${STYLE}

Scene: a sunny park path with short green grass and a few small bushes in the
background, warm daytime light. A boy stands on the left side of the frame and
a friendly dog stands on the right side of the frame, both fully visible from
head to feet/paws, both standing on the same ground line.

Left third of the frame: a boy, about 6 years old, brown hair, wearing a blue
t-shirt and shorts, standing upright, both legs clearly visible and separated
(not overlapping), exactly 2 legs.

Right third of the frame: a friendly medium-sized dog with a spotted coat,
standing on all four legs, all 4 legs clearly visible and separated (not
overlapping, not hidden behind each other), exactly 4 legs.

Both the boy and the dog must be clearly visible in one single frame, each
placed so every one of their legs can be individually counted. Leg count must
be exact: 2 legs on the boy, 4 legs on the dog.`,
  },
  {
    id: "wheels_bike_car", item: "колёс", left: 2, right: 4,
    nameA: "велосипеда", nameANom: "Велосипед", genderA: "object",
    nameB: "машины", nameBNom: "Машина", genderB: "object",
    askKind: "what", // inanimate: "у чего", not "у кого"
    prompt: `${STYLE}

Scene: a bright residential street with a light blue sky, a simple sidewalk
and a few small trees in the background, warm daytime light. A bicycle stands
on the left side of the frame and a car stands on the right side of the frame,
shown from the side so every wheel is clearly visible, both resting on the
same ground line.

Left third of the frame: a red children's bicycle shown from the side, exactly
2 wheels clearly visible, both round and fully visible, not overlapping.

Right third of the frame: a cheerful yellow car shown from the side, exactly 4
wheels clearly visible along the bottom of the car body, evenly spaced, not
overlapping or hidden behind each other.

Both the bicycle and the car must be clearly visible in one single frame, each
placed so every one of their wheels can be individually counted. Wheel count
must be exact: 2 wheels on the bicycle, 4 wheels on the car.`,
  },
  {
    id: "windows_house_building", item: "окон", left: 2, right: 6,
    nameA: "домика", nameANom: "Домик", genderA: "object",
    nameB: "дома", nameBNom: "Дом", genderB: "object",
    askKind: "what", // inanimate: "у чего", not "у кого"
    prompt: `${STYLE}

Scene: a cheerful street with a light blue sky and a few fluffy clouds, a
strip of green grass along the bottom, warm daytime light. A small cottage
stands on the left side of the frame and a taller multi-story building stands
on the right side of the frame, both viewed straight-on from the front, both
resting on the same ground line.

Left third of the frame: a small one-story cottage with a triangular roof and
a front door, exactly 2 square windows on its front wall, clearly separated
and individually countable, not overlapping.

Right third of the frame: a taller building with a flat roof, three floors,
exactly 6 square windows arranged in a clear grid on its front wall (two
windows per floor across three floors), each window clearly separated and
individually countable, not overlapping.

Both buildings must be clearly visible in one single frame, each placed so
every one of their windows can be individually counted. Window count must be
exact: 2 windows on the cottage, 6 windows on the taller building.`,
  },
  {
    id: "petals_tulip_daisy", item: "лепестков", left: 4, right: 8,
    nameA: "тюльпана", nameANom: "Тюльпан", genderA: "object",
    nameB: "ромашки", nameBNom: "Ромашка", genderB: "object",
    askKind: "what", // inanimate: "у чего", not "у кого"
    prompt: `${STYLE}

Scene: a simple sunny garden bed with soft green grass and a light blue sky in
the background, warm daytime light. A tulip flower grows on the left side of
the frame and a daisy flower grows on the right side of the frame, both shown
as a clear frontal view of the flower head atop a green stem with a leaf or
two, both rooted in the same strip of ground.

Left third of the frame: a single tulip flower viewed from the front, its
flower head made of exactly 4 large rounded petals, each petal clearly
separated and individually countable, not overlapping into a solid blob.

Right third of the frame: a single daisy flower viewed from the front, its
flower head made of exactly 8 long thin white petals around a round yellow
center, each petal clearly separated and individually countable, evenly
spaced like a simple sun shape, not overlapping.

Both flowers must be clearly visible in one single frame, each placed so every
one of their petals can be individually counted. Petal count must be exact: 4
petals on the tulip, 8 petals on the daisy.`,
  },
  {
    id: "train_cars_equal", item: "вагонов", left: 3, right: 3,
    nameA: "жёлтого поезда", nameANom: "Жёлтый поезд", genderA: "object",
    nameB: "синего поезда", nameBNom: "Синий поезд", genderB: "object",
    // вагоны — составные части одного целого (как страницы книги), а не
    // прикреплённый снаружи придаток (как колёса/крылья): естественный
    // русский вопрос — "где", не "у кого/чего" ("в поезде десять вагонов",
    // не "у поезда десять вагонов").
    askKind: "where", prep: "в",
    nameALoc: "жёлтом поезде", nameBLoc: "синем поезде",
    prompt: `${STYLE}

Scene: a cheerful countryside scene with a light blue sky, soft green hills,
and simple train tracks running horizontally across the lower half of the
frame, warm daytime light. A yellow toy train sits on the tracks on the left
side of the frame and a blue toy train sits on the tracks on the right side of
the frame, both shown from the side so every car can be clearly counted, both
resting on the same track line.

Left third of the frame: a cheerful yellow toy train made of exactly 3
rectangular cars coupled one after another (including the front engine car),
each car clearly separated by a small visible gap, not overlapping.

Right third of the frame: a cheerful blue toy train made of exactly 3
rectangular cars coupled one after another (including the front engine car),
matching the yellow train in size and style, each car clearly separated by a
small visible gap, not overlapping.

Both trains must be clearly visible in one single frame, each placed so every
one of their cars can be individually counted. Car count must be exact and
equal: 3 cars on the yellow train, 3 cars on the blue train, so the two trains
visibly look the same length at a glance.`,
  },
  {
    id: "floors_cottage_skyscraper", item: "этажей", left: 1, right: 5,
    nameA: "коттеджа", nameANom: "Коттедж", genderA: "object",
    nameB: "небоскрёба", nameBNom: "Небоскрёб", genderB: "object",
    // этажи — внутренняя составляющая здания: "в доме пять этажей", а не
    // "у дома пять этажей" — see train_cars_equal's comment above.
    askKind: "where", prep: "в",
    nameALoc: "коттедже", nameBLoc: "небоскрёбе",
    prompt: `${STYLE}

Scene: a bright city-meets-countryside skyline with a light blue sky and a few
soft clouds, a strip of green ground along the bottom, warm daytime light. A
small one-story cottage stands on the left side of the frame and a tall
skyscraper stands on the right side of the frame, both viewed straight-on from
the front, both resting on the same ground line.

Left third of the frame: a small cottage with a triangular roof and one row of
windows, exactly 1 floor, clearly a single-story building with only one level
of windows above the ground.

Right third of the frame: a tall, narrow skyscraper with a flat roof, exactly
5 floors clearly stacked one on top of another, each floor marked by its own
horizontal row of windows separated by a visible ledge or line, so all 5
floors are individually countable from bottom to top.

Both buildings must be clearly visible in one single frame, each placed so
every one of their floors can be individually counted. Floor count must be
exact: 1 floor on the cottage, 5 floors on the skyscraper.`,
  },
  {
    id: "stairs_small_tall", item: "ступенек", left: 3, right: 7,
    nameA: "маленькой лестницы", nameANom: "Маленькая лестница", genderA: "object",
    nameB: "большой лестницы", nameBNom: "Большая лестница", genderB: "object",
    // ступеньки — часть лестницы, на которой стоят: "на лестнице десять
    // ступенек", а не "у лестницы десять ступенек".
    askKind: "where", prep: "на",
    nameALoc: "маленькой лестнице", nameBLoc: "большой лестнице",
    prompt: `${STYLE}

Scene: a bright simple outdoor scene with a light blue sky and soft green
ground, warm daytime light. A short staircase stands on the left side of the
frame and a tall staircase stands on the right side of the frame, both shown
from the side in profile so every step is clearly visible, both resting on the
same ground line.

Left third of the frame: a short wooden staircase with exactly 3 steps rising
from left to right, each step clearly separated and individually countable,
not overlapping.

Right third of the frame: a tall wooden staircase with exactly 7 steps rising
from left to right, each step clearly separated and individually countable,
not overlapping, matching the short staircase in style and color.

Both staircases must be clearly visible in one single frame, each placed so
every one of their steps can be individually counted. Step count must be
exact: 3 steps on the short staircase, 7 steps on the tall staircase.`,
  },
  {
    id: "sails_boat_ship", item: "парусов", left: 1, right: 2,
    nameA: "лодки", nameANom: "Лодка", genderA: "object",
    nameB: "яхты", nameBNom: "Яхта", genderB: "object",
    askKind: "what", // inanimate: "у чего", not "у кого"
    prompt: `${STYLE}

Scene: a cheerful sea scene with a light blue sky, a few soft clouds, and calm
blue water filling the lower half of the frame, warm daytime light. A small
sailing dinghy floats on the water on the left side of the frame and a
two-masted sailing yacht floats on the water on the right side of the frame,
both shown from the side so every sail is clearly visible, both resting on
the same waterline. Neither boat is a tall ship or galleon — both are small,
modern-looking recreational sailboats, low to the water, with thin wooden
masts, not a big multi-deck wooden hull.

Left third of the frame: a small white sailing dinghy with exactly ONE mast
and exactly ONE triangular sail — nothing else attached to the mast, no
second sail of any size, no flag shape that could be mistaken for a sail.

Right third of the frame: a slightly bigger white sailing yacht with exactly
TWO masts standing side by side (a shorter one and a taller one), each mast
carrying exactly one triangular sail, so exactly two sails total. The two
sails must be clearly separate shapes with a visible gap between them, not
overlapping, not touching.

Both boats must be clearly visible in one single frame, each placed so every
one of their sails can be individually counted. Sail count must be exact: 1
sail on the small dinghy, 2 sails on the yacht — count the masts to check:
1 mast on the left boat, 2 masts on the right boat.`,
  },
  {
    id: "buttons_shirt_coat", item: "пуговиц", left: 3, right: 6,
    nameA: "рубашки", nameANom: "Рубашка", genderA: "object",
    nameB: "пальто", nameBNom: "Пальто", genderB: "object",
    askKind: "what", // inanimate: "у чего", not "у кого"
    prompt: `${STYLE}

Scene: a simple cozy indoor scene with a soft pastel wall and a wooden floor,
warm daytime light, like a tidy bedroom corner. A shirt hangs on a wooden
hanger on the left side of the frame and a coat hangs on a wooden hanger on
the right side of the frame, both shown from the front so every button down
the front is clearly visible, both hangers at the same height.

Left third of the frame: a light blue button-up shirt hanging straight, with
exactly 3 round buttons evenly spaced down the front, each clearly separated
and individually countable.

Right third of the frame: a warm brown coat, extra long (reaching almost to
the floor, longer than a normal coat, to leave room for many buttons),
hanging straight, with exactly SIX round buttons in a single vertical column
down the front, evenly spaced from just below the collar all the way down to
near the hem. Count them out loud while drawing: button 1, button 2, button
3, button 4, button 5, button 6 — there must be six separate round button
shapes, not four, not five, each clearly separated from its neighbors with
visible fabric between them, not overlapping.

Both garments must be clearly visible in one single frame, each placed so
every one of their buttons can be individually counted. Button count must be
exact: 3 buttons on the shirt, 6 buttons on the coat.`,
  },
  {
    id: "wings_bird_butterfly", item: "крыльев", left: 2, right: 4,
    nameA: "птицы", nameANom: "Птица", genderA: "animal",
    nameB: "бабочки", nameBNom: "Бабочка", genderB: "animal",
    prompt: `${STYLE}

Scene: a bright garden scene with a light blue sky, soft green bushes, and a
few flowers in the background, warm daytime light. A small bird sits on a
branch on the left side of the frame and a butterfly rests on a flower on the
right side of the frame, both shown with their wings spread open and clearly
visible, not folded or hidden.

Left third of the frame: a small cheerful bird with its wings spread open,
exactly 2 wings clearly visible, one on each side of its body, not
overlapping.

Right third of the frame: a colorful butterfly drawn from directly above/behind
(a top-down view of the open wings, not a side view), with its wings spread
fully open flat like an X shape. It must have exactly FOUR separate wing
lobes, each its own clearly outlined rounded shape with a visible gap or
outline between neighbors — not two large wings that merely have a color
pattern painted on them. Count them out loud while drawing: wing 1 (upper
left), wing 2 (upper right), wing 3 (lower left), wing 4 (lower right) — four
separate lobes total, not two, with the thin body/thorax visible as a dividing
line down the middle separating left from right, and a clear notch or seam
between each upper lobe and the lower lobe right below it.

Both the bird and the butterfly must be clearly visible in one single frame,
each placed so every one of their wings can be individually counted. Wing
count must be exact: 2 wings on the bird, 4 wings on the butterfly.`,
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
    // askKind: "who" (default, animate — "У кого больше ног?") | "what"
    // (inanimate appendage — "У чего больше колёс?") | "where" (inanimate,
    // internal/sequential part — "Где больше вагонов?", answered "в/на X").
    ...(scene.askKind ? { askKind: scene.askKind } : {}),
    ...(scene.prep ? { prep: scene.prep } : {}),
    ...(scene.nameALoc ? { nameALoc: scene.nameALoc } : {}),
    ...(scene.nameBLoc ? { nameBLoc: scene.nameBLoc } : {}),
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
