// scripts/gen-review-html.mjs  — временный скрипт для проверки колоды
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/projects/tools_functions/generated";
const OUT = "C:/Users/dmazn/OneDrive/Desktop/tools_review.html";

const CONCEPTS = [
  { id:"hammer",       label:"Молоток",       needsForm:"нужен",  labelInstrumental:"молотком",       action:"забивают гвозди",     actionInf:"забивать гвозди",     sceneQuestion:"Нужно забить гвоздь. Что взять?" },
  { id:"screwdriver",  label:"Отвёртка",      needsForm:"нужна",  labelInstrumental:"отвёрткой",      action:"закручивают шурупы",  actionInf:"закручивать шурупы",  sceneQuestion:"Нужно закрутить шуруп. Что взять?" },
  { id:"drill",        label:"Дрель",         needsForm:"нужна",  labelInstrumental:"дрелью",         action:"сверлят отверстия",   actionInf:"сверлить отверстия",  sceneQuestion:"Нужно просверлить отверстие в стене. Что взять?" },
  { id:"handsaw",      label:"Пила",          needsForm:"нужна",  labelInstrumental:"пилой",          action:"пилят доску",         actionInf:"пилить доску",        sceneQuestion:"Нужно распилить доску. Что взять?" },
  { id:"wrench",       label:"Гаечный ключ",  needsForm:"нужен",  labelInstrumental:"гаечным ключом", action:"закручивают гайки",   actionInf:"закручивать гайки",   sceneQuestion:"Нужно затянуть гайку на болте. Что взять?" },
  { id:"pliers",       label:"Пассатижи",     needsForm:"нужны",  labelInstrumental:"пассатижами",    action:"сгибают проволоку",   actionInf:"сгибать проволоку",   sceneQuestion:"Нужно согнуть проволоку. Что взять?" },
  { id:"wire_cutters", label:"Кусачки",       needsForm:"нужны",  labelInstrumental:"кусачками",      action:"режут проволоку",     actionInf:"резать проволоку",    sceneQuestion:"Нужно перекусить проволоку. Что взять?" },
  { id:"tape_measure", label:"Рулетка",       needsForm:"нужна",  labelInstrumental:"рулеткой",       action:"измеряют длину",      actionInf:"измерять длину",      sceneQuestion:"Нужно измерить длину предмета. Что взять?" },
  { id:"paintbrush",   label:"Кисточка",      needsForm:"нужна",  labelInstrumental:"кисточкой",      action:"красят поверхность",  actionInf:"красить поверхность", sceneQuestion:"Нужно покрасить стену. Что взять?" },
  { id:"spatula",      label:"Шпатель",       needsForm:"нужен",  labelInstrumental:"шпателем",       action:"наносят шпаклёвку",   actionInf:"наносить шпаклёвку",  sceneQuestion:"Нужно заделать трещину в стене. Что взять?" },
  { id:"drill_bit",    label:"Сверло",        needsForm:"нужно",  labelInstrumental:"сверлом",        action:"сверлят дерево",      actionInf:"сверлить дерево",     sceneQuestion:"Нужно просверлить дырку в деревянном бруске. Что взять?" },
  { id:"ruler",        label:"Линейка",       needsForm:"нужна",  labelInstrumental:"линейкой",       action:"чертят ровные линии", actionInf:"чертить ровные линии",sceneQuestion:"Нужно провести ровную линию на бумаге. Что взять?" },
];

function img64(file) {
  const p = join(DIR, file);
  if (!existsSync(p)) return null;
  return "data:image/webp;base64," + readFileSync(p).toString("base64");
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

const rows = CONCEPTS.map((c, i) => {
  const tool  = img64(`${c.id}_tool_1.webp`);
  const scene = img64(`${c.id}_scene_after.webp`);
  const imgTool  = tool  ? `<img src="${tool}"  title="${c.id}_tool_1">` : `<div class="miss">нет фото</div>`;
  const imgScene = scene ? `<img src="${scene}" title="${c.id}_scene_after">` : `<div class="miss">нет фото</div>`;

  const q1 = "Что это?";
  const a1 = `Это ${c.label}.`;
  const q2 = `Для чего ${c.needsForm} ${c.label}?`;
  const a2 = `${cap(c.labelInstrumental)} ${c.action}!`;
  const q3 = c.sceneQuestion;

  return `
  <div class="pair">
    <div class="num">${i + 1}</div>
    <div class="photos">${imgTool}${imgScene}</div>
    <div class="info">
      <div class="cid"><code>${c.id}</code></div>
      <table>
        <tr><td class="q">${q1}</td><td class="a">${a1}</td></tr>
        <tr><td class="q">${q2}</td><td class="a">${a2}</td></tr>
        <tr><td class="q">${q3}</td><td class="a">→ выбрать инструмент из 4</td></tr>
      </table>
    </div>
  </div>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Инструменты — проверка пар</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #f2f2f2; padding: 28px 20px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.3rem; color: #333; margin-bottom: 24px; }
  .pair { background: #fff; border-radius: 14px; padding: 16px 20px; margin-bottom: 16px;
          display: flex; gap: 18px; align-items: flex-start;
          box-shadow: 0 1px 5px rgba(0,0,0,.09); }
  .num { font-size: 1.8rem; font-weight: 800; color: #ccc; min-width: 36px; line-height: 1; padding-top: 6px; }
  .photos { display: flex; gap: 8px; flex-shrink: 0; }
  .photos img { width: 130px; height: 130px; object-fit: cover; border-radius: 10px; border: 1px solid #eee; }
  .miss { width: 130px; height: 130px; background: #fff0f0; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: .75rem; color: #c00; border: 1px solid #fcc; }
  .info { flex: 1; min-width: 0; }
  .cid { font-size: .72rem; color: #aaa; margin-bottom: 8px; }
  code { background: #f4f4f4; padding: 1px 6px; border-radius: 4px; font-size: .85em; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 5px 6px; font-size: .92rem; vertical-align: top; border-bottom: 1px solid #f4f4f4; }
  tr:last-child td { border-bottom: none; }
  .q { color: #777; font-weight: 500; white-space: nowrap; padding-right: 14px; width: 1%; }
  .a { color: #111; font-weight: 600; }
</style>
</head>
<body>
<h1>Инструменты и их применение — 12 пар (предмет + сцена после)</h1>
${rows}
</body>
</html>`;

writeFileSync(OUT, html, "utf8");
console.log("✅ Готово:", OUT);
