// «По слогам» (propis2): re-records a syllable the model got wrong said alone («Ве.» → «вэ», «пэ»; «Ми.» → «мы»; «Чер.» → «чор»: owner's
// review, 2026-10-29, 42 of 228). Tried (2026-10-29, judged by ElevenLabs speech-to-text, which agreed with the owner's ear on the
// approved and rejected clips): alone, lowercase, «ми, ми», multilingual_v2 and inside the word («Ми — ла.») all keep the error. What
// works is a carrier phrase that names it a syllable and gives a word: «Слог «ми», как в слове «Миша».», often with a stress mark on the
// vowel (it stops е → ё: чер, звез). The syllable is cut out of the phrase by ElevenLabs' character timestamps.
// Up to --tries takes per syllable (with / without the stress mark in turn); each is checked by speech-to-text (the word after «Слог»
// must be the syllable) and the first --takes that pass are kept; if fewer pass, the last tried fill up, marked unverified.
// Writes <out>/syl_<syllable>__<n>.mp3 (n = 1, 2) and <out>/candidates.json (syllable, host word, text) for the review page.
// Same voice, model and tag as generate-propis-dictation-elevenlabs.mjs. Needs ffmpeg.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/generate-dictation-syllables-in-word.mjs --only=ве,ви --out=<dir> [--takes=2] [--tries=4] [--said=…]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ID = "R2G2Gb9OjCtLhIBQErXd"; // «Дмитрий Мазниченко», cloned
const MODEL_ID = "eleven_v4";
const TAG = "[calm, clear, like a teacher dictating to a class]";
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
if (!args.only || !args.out) throw new Error("--only=<syllables> and --out=<dir> are required");
const ONLY = String(args.only).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const OUT = resolve(args.out);
const TAKES = Number(args.takes ?? 2);
const TRIES = Number(args.tries ?? 4);
// --said=роз:роззз|ро-з,дце:д-це -- how to write a syllable in the phrase, tried in turn instead of the stress-mark / plain pair. A voiced
// final consonant is devoiced in speech (роз → «рос», радь → «рать»); stretching it («роззз») or setting it apart («ро-з») keeps it voiced.
const SAID = Object.fromEntries(String(args.said ?? "").split(",").filter(Boolean).map((x) => { const [k, v] = x.split(":"); return [k, v.split("|")]; }));
const apiKey = process.env.ELEVENLABS_API_KEY;

const topic = JSON.parse(readFileSync(join(ROOT, "tools/propis2/topic.json"), "utf8"));
const hostsOf = (syl) => topic.words.filter((w) => (w.syllables ?? []).some((s) => s.toLowerCase() === syl));

async function listen(file) {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "rus");
  fd.append("file", new Blob([readFileSync(file)]), "a.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: apiKey ? { "xi-api-key": apiKey } : {}, body: fd });
  return res.ok ? (await res.json()).text ?? "" : "";
}
// the word the recognizer heard after «Слог»
const heardSyllable = (text) => (text.match(/слог[^а-яё]*([а-яё]+)/i)?.[1] ?? "").toLowerCase();
const stressed = (syl) => syl.replace(/[аеёиоуыэюя]/, (v) => `${v}\u0301`);

async function speak(text) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { "xi-api-key": apiKey } : {}) },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    });
    if (res.ok) return res.json();
    if (attempt >= 4 || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

// the first stretch of sound in [from, to] of a file (a click or a breath shorter than 0.08 s is skipped)
function soundIn(file, from, to) {
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(from), "-to", String(to), "-i", file, "-af", "silencedetect=n=-38dB:d=0.06", "-f", "null", "-"], { encoding: "utf8" });
  const starts = [...stderr.matchAll(/silence_start: ([\d.-]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const len = to - from;
  const edges = [0, ...starts.flatMap((s, i) => [Math.max(0, s), ends[i] ?? len]), len];
  for (let i = 0; i < edges.length; i += 2) if (edges[i + 1] - edges[i] >= 0.08) return [from + edges[i], from + edges[i + 1]];
  return [from, to];
}

mkdirSync(OUT, { recursive: true });
const raw = join(OUT, "raw");
mkdirSync(raw, { recursive: true });
const made = [];
for (const syl of ONLY) {
  const host = hostsOf(syl)[0];
  if (!host) { console.warn(`no word has «${syl}»`); continue; }
  const tries = [];
  for (let t = 1; t <= TRIES && tries.filter((x) => x.ok).length < TAKES; t += 1) {
    const said = SAID[syl] ? SAID[syl][(t - 1) % SAID[syl].length] : t % 2 === 1 ? stressed(syl) : syl;
    const text = `${TAG} Слог «${said}», как в слове «${host.word.toLowerCase()}».`;
    const { audio_base64: audio, alignment } = await speak(text);
    const file = join(raw, `${syl}__t${t}.mp3`);
    writeFileSync(file, Buffer.from(audio, "base64"));
    if (alignment.characters.join("") !== text) throw new Error(`alignment does not match the text for ${syl}`);
    const at = text.indexOf("«") + 1;
    const t0 = alignment.character_start_times_seconds[at];
    const t1 = alignment.character_end_times_seconds[at + said.length - 1];
    const next = alignment.character_start_times_seconds[at + said.length + 2] ?? t1 + 0.4; // the word after «…», (a pause in between)
    const [a, b] = soundIn(file, Math.max(0, t0 - 0.12), Math.min(next, t1 + 0.35));
    const heard = await listen(file);
    tries.push({ t, file, a, b, said, heard, ok: heardSyllable(heard) === syl });
    console.log(`${heardSyllable(heard) === syl ? "✓" : "·"} ${syl} try ${t}  «${said}»  heard: ${heard}`);
  }
  const keep = [...tries.filter((x) => x.ok), ...tries.filter((x) => !x.ok).reverse()].slice(0, TAKES);
  keep.forEach((x, i) => {
    const start = Math.max(0, x.a - 0.03);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", x.file, "-af", `atrim=${start}:${x.b + 0.06},asetpts=PTS-STARTPTS,afade=t=out:st=${x.b - start}:d=0.06`, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", join(OUT, `syl_${syl}__${i + 1}.mp3`)]);
    made.push({ syllable: syl, n: i + 1, word: host.word, said: x.said, heard: x.heard, verified: x.ok, seconds: Number((x.b - x.a).toFixed(2)) });
  });
}
writeFileSync(join(OUT, "candidates.json"), JSON.stringify(made, null, 1));
