// Ready notebooks of the Slovenian language in «Прописи: латиница» (docs/propis2-sl.md, step 5; owner 2026-11-14: «Сделай тетради»):
// built from the words of «Za začetek» («Besede, besede, besede», pp. 53–58 — a course for adults, so the words are picked for children:
// no cigareta, bar, policist …) into tools/propis2/sl-kits.json, which scripts/build-propis2-deck.mjs turns into pages with the Latin
// builder (scripts/lib/propis2-latin-kits.mjs: 10 rows a page — the Slovene paper 5 mm on A5 has 10, as the British one).
//   Abeceda ×3 (the three steps of the Slovene school: velike tiskane → male tiskane → pisane): a page per letter — the letter (capital
//     and small apart, «F f»: joined, f ran into F's bar and t under T's) traced
//     along the row, then fading out; three words with it, each fading out, then once and the child's own.
//   Števila — numbers in words; Dnevi in meseci — the days, the months, the date; Moji podatki — name, address, town, country (capitals).
// Run: node tools/propis2/build-sl-kits.mjs → tools/propis2/sl-kits.json
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ABC = [
  ["A", ["abeceda", "april", "Avstrija"]],
  ["B", ["banana", "beseda", "brat"]],
  ["C", ["cesta", "cvet", "center"]],
  ["Č", ["čaj", "čokolada", "čebula"]],
  ["D", ["dežnik", "denar", "država"]],
  ["E", ["ena", "evro", "elektrika"]],
  ["F", ["film", "februar", "fotoaparat"]],
  ["G", ["glava", "gospa", "gospod"]],
  ["H", ["hiša", "hrana", "hotel"]],
  ["I", ["in", "Italija", "internet"]],
  ["J", ["ja", "jakna", "jezik"]],
  ["K", ["kruh", "kava", "knjiga"]],
  ["L", ["list", "limona", "Ljubljana"]],
  ["M", ["mama", "meso", "mesto"]],
  ["N", ["ne", "nogomet", "november"]],
  ["O", ["okno", "omara", "oktober"]],
  ["P", ["pes", "paprika", "pijača"]],
  ["R", ["riž", "roža", "radio"]],
  ["S", ["sadje", "Slovenija", "slovenščina"]],
  ["Š", ["šola", "šport", "številka"]],
  ["T", ["telefon", "trgovina", "televizija"]],
  ["U", ["ura", "ulica", "učiteljica"]],
  ["V", ["voda", "vaja", "vreme"]],
  ["Z", ["zelenjava", "zdravnik", "zemljevid"]],
  ["Ž", ["žoga", "žival", "ženska"]],
];

const abcKit = (id, title, style, letter, description) => ({
  id, title, group: "Abeceda", style, description,
  pages: ABC.map(([L, words]) => ({ title: `${L} ${L.toLowerCase()}`, pattern: [letter(L)], trace: words })),
});

const kits = [
  abcKit("sl-abc-caps", "Velike tiskane črke", "sl_caps", (L) => L,
    "1. razred: vse črke abecede z velikimi tiskanimi črkami — črka po vrsti (obrisuj, nato bledi), tri besede s to črko."),
  abcKit("sl-abc-print", "Male tiskane črke", "sl_print", (L) => `${L} ${L.toLowerCase()}`,
    "Velika in mala tiskana črka, tri besede s to črko — vsaka beseda bledi, nato jo napiše sam."),
  abcKit("sl-abc-cursive", "Pisane črke", "sl_cursive", (L) => `${L} ${L.toLowerCase()}`,
    "2. razred: velika in mala pisana črka, povezane; tri besede s to črko — vsaka beseda bledi, nato jo napiše sam."),
  { id: "sl-stevila", title: "Števila", group: "Besede", style: "sl_cursive",
    description: "Števila z besedo: od nič do dvajset, desetice do sto.",
    pages: [
      { title: "0 – 4", trace: ["nič", "ena", "dve", "tri", "štiri"] },
      { title: "5 – 9", trace: ["pet", "šest", "sedem", "osem", "devet"] },
      { title: "10 – 14", trace: ["deset", "enajst", "dvanajst", "trinajst", "štirinajst"] },
      { title: "15 – 19", trace: ["petnajst", "šestnajst", "sedemnajst", "osemnajst", "devetnajst"] },
      { title: "10 – 50", trace: ["dvajset", "trideset", "štirideset", "petdeset", "sto"] },
      { title: "60 – 100", trace: ["šestdeset", "sedemdeset", "osemdeset", "devetdeset", "tisoč"] },
    ] },
  { id: "sl-dnevi", title: "Dnevi in meseci", group: "Besede", style: "sl_cursive",
    description: "Dnevi v tednu, meseci v letu in datum: Danes je ponedeljek.",
    pages: [
      { title: "Dnevi 1", trace: ["ponedeljek", "torek", "sreda", "četrtek", "petek"] },
      { title: "Dnevi 2", trace: ["sobota", "nedelja", "dan", "teden", "danes"] },
      { title: "Meseci 1", trace: ["januar", "februar", "marec", "april", "maj"] },
      { title: "Meseci 2", trace: ["junij", "julij", "avgust", "september", "oktober"] },
      { title: "Meseci 3", trace: ["november", "december", "mesec", "leto", "datum"] },
      { title: "Danes je …", copy: ["Danes je ponedeljek.", "Danes je prvi december.", "Kateri dan je danes?", "Kdaj je koncert?", "Rodil sem se maja."] },
    ] },
  { id: "sl-podatki", title: "Moji podatki", group: "Besede", style: "sl_cursive",
    description: "Velika začetnica: ime in priimek, naslov, mesto, država.",
    pages: [
      { title: "Besede", trace: ["ime", "priimek", "naslov", "mesto", "država"] },
      { title: "Velika začetnica", trace: ["Ana", "Kogoj", "Ljubljana", "Slovenija", "Maribor"] },
      { title: "Moji podatki", copy: ["Ime: Ana", "Priimek: Kogoj", "Ulica: Tržaška", "Mesto: Ljubljana", "Država: Slovenija"] },
    ] },
];

const out = {
  note: "Готовые тетради словенского языка (docs/propis2-sl.md, шаг 5): собирает tools/propis2/build-sl-kits.mjs (не править руками). Слова из «Za začetek» (с. 53–58), отобраны для детей. Бумага — словенская 5 мм на A5 (10 строк, как у британской).",
  page: { gridKind: "sl", format: "a5" },
  kits,
};
writeFileSync(fileURLToPath(new URL("./sl-kits.json", import.meta.url)), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${kits.length} notebooks, ${kits.reduce((n, k) => n + k.pages.length, 0)} pages → tools/propis2/sl-kits.json`);
