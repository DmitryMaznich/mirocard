import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const draft = JSON.parse(await readFile(path.join(root, "content/reading_short_stories/micro/editorial-draft.json"), "utf8"));
const template = JSON.parse(await readFile(path.join(root, "docs/design/reading-sheet-illustrations.template.json"), "utf8"));
const previous = JSON.parse(await readFile(path.join(root, "content/reading_short_stories/micro/stories.json"), "utf8"));
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const output = path.join(root, "output/reading-micro/editorial-review.html");
if (draft.stories.length !== 15) throw new Error("Expected fifteen stories.");

function squareCrop(width, height, spec) {
  const inset = template.source_edge_inset;
  const side = Math.min(width, height) * (1 - 2 * inset);
  const left = Math.max(width * inset, Math.min(width * spec.focus[0] - side / 2, width * (1 - inset) - side));
  const top = Math.max(height * inset, Math.min(height * spec.focus[1] - side / 2, height * (1 - inset) - side));
  const [x1, y1, x2, y2] = spec.protected_bounds;
  if (left / width > x1 || top / height > y1 || (left + side) / width < x2 || (top + side) / height < y2) {
    throw new Error("Square crop removes protected content.");
  }
  return { left: Math.round(left), top: Math.round(top), width: Math.floor(side), height: Math.floor(side) };
}

const articles = [];
for (const [index, story] of draft.stories.entries()) {
  if (story.textStatus !== "agreed" || story.questionsStatus !== "agreed") throw new Error("Unagreed content: " + story.id);
  if (story.lines.length < 4 || story.lines.length > 5 || story.questions.length < 5) throw new Error("Invalid story length/questions: " + story.id);
  if (!story.questions[0].question.startsWith("Как зовут")) throw new Error("First question must ask the name: " + story.id);
  const storyText = story.lines.join(" ").toLocaleLowerCase("ru");
  for (const q of story.questions) for (const a of q.acceptedAnswers) {
    if (!storyText.includes(a.toLocaleLowerCase("ru"))) throw new Error("Answer absent from text: " + story.id + " / " + a);
  }
  const config = template.stories[story.id] ?? {};
  const source = story.illustration?.source ?? `scripts/assets/reading_short_stories/micro/${config.source ?? story.id + ".png"}`;
  const bytes = await readFile(path.join(root, source));
  const { width, height } = await sharp(bytes).metadata();
  const half = Math.floor(width / 2);
  const frames = story.illustration?.frames ?? previous.find((s) => s.id === story.id).frames;
  const images = [];
  for (let frame = 0; frame < 2; frame++) {
    const spec = config.frames?.[frame] ?? (story.id === "micro_ball" ? template.frames[frame] : template.default_frame);
    const square = squareCrop(half, height, spec);
    const buffer = await sharp(bytes).extract({ ...square, left: square.left + frame * half }).resize(640, 640).webp({ quality: 86 }).toBuffer();
    images.push(`<img width="640" height="640" alt="${escape(frames[frame])}" src="data:image/webp;base64,${buffer.toString("base64")}">`);
  }
  articles.push(`<article id="${story.id}" data-story="${index}"${index ? " hidden" : ""}>
    <p class="chapter">Рассказ ${index + 1} из 15</p><h1 tabindex="-1">${escape(story.title)}</h1>
    <div class="story-layout"><div class="illustrations">${images.join("")}</div>
      <div class="story-text">${story.lines.map((line) => `<p>${escape(line)}</p>`).join("")}</div></div>
    <details class="questions"><summary>Вопросы и ответы <span>${story.questions.length}</span></summary>
      <ol>${story.questions.map((q) => `<li><p class="question">${escape(q.question)}</p><p class="answer">${q.acceptedAnswers.map(escape).join(' <span class="or">или</span> ')}</p></li>`).join("")}</ol>
    </details>
  </article>`);
}

const fonts = await Promise.all([400, 700].map(async (weight) => {
  const data = await readFile(path.join(root, `tools/propis2/pdf-fonts/Nunito-${weight}.ttf`));
  return `@font-face{font-family:Nunito;font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/ttf;base64,${data.toString("base64")}) format('truetype')}`;
}));
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Микрорассказы — согласованная подборка</title><style>
${fonts.join("\n")}
:root{color-scheme:light;--ink:#203d44;--muted:#63777c;--green:#356d60;--line:#e0e8e6}*{box-sizing:border-box}html{scroll-padding-bottom:100px}body{margin:0;background:#fff;color:var(--ink);font-family:Nunito,sans-serif}button,select{font:inherit}button,summary,select{-webkit-tap-highlight-color:transparent}button,summary{cursor:pointer}button:focus-visible,summary:focus-visible,select:focus-visible{outline:3px solid #91baaf;outline-offset:4px}button:disabled{opacity:.4;cursor:default}[hidden]{display:none!important}
header,main,.nav-inner{width:min(1120px,100%);margin-inline:auto}header{padding:25px 36px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line)}.brand{margin:0;font-weight:700;font-size:20px}.stage{margin:3px 0 0;color:var(--muted);font-size:14px}select{width:270px;max-width:100%;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:10px;min-height:46px;padding:8px 12px;font-size:15px}.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}main{padding:30px 36px calc(120px + env(safe-area-inset-bottom))}.chapter{margin:0 0 8px;font-size:14px;color:var(--muted)}h1{font-size:36px;line-height:1.2;letter-spacing:-.02em;margin:0 0 30px;outline:none}.story-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:38px;align-items:center}.illustrations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.illustrations img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:18px}.story-text{font-size:25px;line-height:1.5}.story-text p{margin:0 0 14px}.story-text p:last-child{margin-bottom:0}.questions{margin-top:32px;border-top:1px solid var(--line);padding-top:19px}.questions summary{font-size:17px;font-weight:700;list-style:none;display:flex;align-items:center;gap:10px;width:fit-content;min-height:44px}.questions summary::-webkit-details-marker{display:none}.questions summary:before{content:'+';font-weight:400;font-size:24px;color:var(--green);width:20px}.questions[open] summary:before{content:'−'}.questions summary span{font-size:13px;font-weight:400;color:var(--muted);border:1px solid var(--line);padding:0 7px;border-radius:12px}.questions ol{padding:0;list-style-position:inside;counter-reset:question;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 30px;margin:12px 0}.questions li{list-style:none;border-bottom:1px solid var(--line);padding:15px 0;counter-increment:question;position:relative;padding-left:30px}.questions li:before{content:counter(question) '.';position:absolute;left:0;top:16px;color:var(--muted);font-size:15px}.question{font-size:18px;line-height:1.4;margin:0 0 7px;font-weight:700}.answer{font-size:18px;line-height:1.45;margin:0;color:var(--green)}.or{font-size:14px;color:var(--muted)}
nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.98);border-top:1px solid var(--line);z-index:5}.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 36px calc(14px + env(safe-area-inset-bottom))}.nav-inner button{min-height:48px;min-width:140px;padding:10px 24px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:700;font-size:17px}.nav-inner button.next{background:var(--green);color:#fff;border-color:var(--green)}.counter{font-size:15px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
@media(max-width:850px){.story-layout{grid-template-columns:1fr;gap:26px}.illustrations{max-width:570px}.story-text{font-size:25px}h1{font-size:32px}}
@media(max-width:540px){header{padding:18px 20px;align-items:flex-start;flex-direction:column;gap:13px}select{width:100%;font-size:16px}.brand{font-size:18px}.stage{font-size:13px}main{padding:23px 20px calc(108px + env(safe-area-inset-bottom))}h1{font-size:29px;margin-bottom:22px}.chapter{font-size:13px}.illustrations{gap:10px}.illustrations img{border-radius:14px}.story-layout{gap:23px}.story-text{font-size:23px;line-height:1.5}.story-text p{margin-bottom:13px}.questions{margin-top:25px}.questions ol{grid-template-columns:1fr}.question,.answer{font-size:17px}.nav-inner{padding:12px 16px calc(12px + env(safe-area-inset-bottom));gap:8px}.nav-inner button{min-width:0;padding:10px 20px}.counter{font-size:14px}}
@media(max-height:500px) and (min-width:600px){header{padding-block:12px}main{padding-top:20px}.story-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:25px}h1{font-size:28px;margin-bottom:20px}.story-text{font-size:21px;line-height:1.45}.story-text p{margin-bottom:10px}.nav-inner{padding-block:8px}.nav-inner button{min-height:42px}}
@media print{header,nav{display:none!important}main{padding:0;max-width:none}article[hidden]{display:block!important}article{break-after:page;padding:0}.chapter{margin-top:0}h1{font-size:28pt}.story-layout{grid-template-columns:1fr;gap:20px}.illustrations{max-width:130mm}.story-text{font-size:18pt}.questions{break-inside:avoid}.questions>ol{display:grid!important}.questions summary{font-size:14pt}.questions summary:before{display:none}.question,.answer{font-size:11pt}}
</style></head><body><header><div><p class="brand">Микрорассказы</p><p class="stage">Первая ступень · 15 рассказов</p></div><label class="sr" for="story-picker">Выбрать рассказ</label><select id="story-picker">${draft.stories.map((s, i) => `<option value="${i}">${i + 1}. ${escape(s.title)}</option>`).join("")}</select></header>
<main>${articles.join("\n")}</main><nav aria-label="Переключение рассказов"><div class="nav-inner"><button id="previous" type="button">← Назад</button><span class="counter" aria-live="polite">1 / 15</span><button class="next" id="next" type="button">Дальше →</button></div></nav>
<script>
const articles=Array.from(document.querySelectorAll('article'));const picker=document.getElementById('story-picker');let current=0;
function show(index,focus=false){current=Math.max(0,Math.min(articles.length-1,index));articles.forEach((a,i)=>a.hidden=i!==current);picker.value=String(current);document.getElementById('previous').disabled=current===0;document.getElementById('next').disabled=current===articles.length-1;document.querySelector('.counter').textContent=(current+1)+' / '+articles.length;document.title=articles[current].querySelector('h1').textContent+' — Микрорассказы';history.replaceState(null,'','#'+articles[current].id);window.scrollTo(0,0);if(focus)articles[current].querySelector('h1').focus({preventScroll:true});}
document.getElementById('previous').onclick=()=>show(current-1,true);document.getElementById('next').onclick=()=>show(current+1,true);picker.onchange=()=>show(Number(picker.value),true);document.addEventListener('keydown',e=>{if(e.target.closest('select,input,textarea'))return;if(e.key==='ArrowRight')show(current+1,true);if(e.key==='ArrowLeft')show(current-1,true);});const requested=articles.findIndex(a=>a.id===location.hash.slice(1));show(requested<0?0:requested);
</script></body></html>`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
const preview = path.join(root, ".cache/reading-micro-preview");
await mkdir(preview, { recursive: true });
await copyFile(output, path.join(preview, "reading-micro-editorial.html"));
console.log(JSON.stringify({ output, stories: draft.stories.length, questions: draft.stories.reduce((n, s) => n + s.questions.length, 0), frames: draft.stories.length * 2, bytes: Buffer.byteLength(html) }));
