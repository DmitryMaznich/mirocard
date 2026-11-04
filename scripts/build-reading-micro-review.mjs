import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [stories, review] = await Promise.all([
  readJson("content/reading_short_stories/micro/stories.json"),
  readJson("content/reading_short_stories/micro/editorial-review.json"),
]);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const stripSyllables = (value) => value.replace(/(\p{L})-(?=\p{L})/gu, "$1");
const countLabel = (value, forms) => `${value} ${forms[value % 100 >= 11 && value % 100 <= 14 ? 2 : value % 10 === 1 ? 0 : value % 10 >= 2 && value % 10 <= 4 ? 1 : 2]}`;
const list = (items, ordered = false) => `<${ordered ? "ol" : "ul"}>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
const section = (title, text) => `<h3>${escape(title)}</h3><p>${escape(text)}</p>`;
if (review.stories.length !== stories.length) throw new Error("Review must cover every story.");
const entries = stories.map((story, index) => {
  const note = review.stories.find((entry) => entry.id === story.id);
  if (!note) throw new Error(`Missing review: ${story.id}`);
  const lines = story.lines.map(stripSyllables);
  return { story, note, lines, index, words: lines.reduce((count, line) => count + line.split(/\s+/).length, 0) };
});
const byKind = (story, kind) => story.questions.filter((question) => question.kind === kind);
const total = (kind) => stories.reduce((n, story) => n + byKind(story, kind).length, 0);
const levelNames = { 1: "цепочка действий", 2: "проблема и решение", 3: "двое участников, речь" };
const questionList = (items) => `<ol class="questions">${items.map(({ prompt, targets }) => `<li>${escape(prompt)} <span>→ ${targets.map(escape).join(" / ")}</span></li>`).join("")}</ol>`;
const toc = entries.map(({ story, note, index }) => `<tr><td><a href="#${escape(story.id)}">${index + 1}. ${escape(story.title)}</a></td><td>${story.level} · ${escape(levelNames[story.level])}</td><td>${escape(note.learningTarget)}</td></tr>`).join("");
const cards = entries.map(({ story, note, lines, index, words }) => `<article id="${escape(story.id)}">
  <p class="eyebrow">${String(index + 1).padStart(2, "0")} / 15 · уровень ${story.level} · ${countLabel(lines.length, ["предложение", "предложения", "предложений"])} · ${countLabel(words, ["слово", "слова", "слов"])}</p>
  <h2>${escape(story.title)}</h2><p class="decision">${escape(note.decision)}</p>
  ${section("Задача", note.learningTarget)}
  <div class="text">${lines.map((line) => `<p>${escape(line)}</p>`).join("")}</div>
  ${section("Связность события", note.coherence)}
  ${note.questionChanges.length ? `<h3>Что изменено в вопросах</h3>${list(note.questionChanges)}` : ""}
  <h3>Вопросы на поиск — слова вопроса есть в предложении</h3>${questionList(byKind(story, "find"))}
  <h3>Вопросы на понимание — ответ в тексте, слов вопроса там нет</h3>${questionList(byKind(story, "gist"))}
  <aside><h3>Разговор со взрослым, без оценки</h3><p>${escape(story.discussion.prompt)}</p><p class="answer">Пример ответа: ${escape(story.discussion.answer)}</p></aside>
  ${section("Проверка иллюстраций", note.illustrationReview)}
  <p><strong>Слова и отношения, которые могут потребовать показа:</strong> ${note.vocabulary.map(escape).join(", ")}.</p>
</article>`).join("");
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Микрорассказы — разбор всех 15 текстов</title><style>
:root{color-scheme:light;--ink:#203f47;--muted:#586970;--rule:#dbe3e4;--accent:#a35336}*{box-sizing:border-box}
body{margin:0;background:#f3f5f5;color:var(--ink);font:17px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:48px 32px 80px;background:#fff}
h1,h2,h3{line-height:1.25}h1{font-size:38px;max-width:800px;margin:8px 0 24px}h2{font-size:30px;margin:8px 0}h3{font-size:18px;margin:26px 0 8px}
p{margin:10px 0}a{color:#245c76;text-underline-offset:3px}li{margin:8px 0}.eyebrow{color:var(--accent);font-size:14px;font-weight:650;letter-spacing:.04em}
.lead{font-size:21px}.muted,.answer,.questions span{color:var(--muted)}.decision{color:var(--accent);font-weight:600}.counts{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0;padding:18px 0;border-block:1px solid var(--rule)}
table{border-collapse:collapse;width:100%;font-size:15px;margin:24px 0}th,td{text-align:left;vertical-align:top;padding:12px 10px;border-bottom:1px solid var(--rule)}th:first-child{width:28%}
article{border-top:2px solid var(--rule);margin-top:48px;padding-top:32px;scroll-margin-top:24px}.text{border-left:3px solid var(--accent);padding:8px 24px;margin:24px 0;font-size:23px;line-height:1.65}.text p{margin:8px 0}
aside{margin:24px 0;padding:4px 24px 16px;background:#f5f7f7;border-radius:12px}aside .muted{font-size:14px}.sources{font-size:15px}footer{margin-top:48px;border-top:1px solid var(--rule);padding-top:24px;font-size:14px;color:var(--muted)}
@media(max-width:640px){main{padding:28px 18px 56px}h1{font-size:29px}h2{font-size:25px}.lead{font-size:18px}.text{font-size:21px;padding-left:16px}table{font-size:13px}th,td{padding:10px 4px}.counts{gap:12px}aside{padding-inline:16px}}
@media print{body{background:#fff;font-size:11pt}main{max-width:none;padding:0}article{break-before:page;margin:0;padding-top:0;border-top:0}aside,.text{break-inside:avoid}h2,h3{break-after:avoid}a{color:inherit}table{font-size:9pt}}
</style></head><body><main>
<p class="eyebrow">МЕТОДИЧЕСКАЯ РЕДАКТУРА · ${escape(review.date)} · РЕДАКЦИЯ ${escape(review.edition)}</p>
<h1>Понимание короткого события: все 15 микрорассказов</h1>
<p class="lead">${escape(review.purpose)}</p><p>${escape(review.scope)}</p>
<div class="counts"><strong>15 рассказов · 3 уровня</strong><span>${total("find")} вопросов на поиск</span><span>${total("gist")} на понимание</span><span>${stories.length} для разговора</span></div>
<p>${escape(review.evidenceBoundary)}</p>
<h2>Критерии первой ступени</h2>${list(review.principles)}
<h2>Что показывает выполнение</h2>${list(review.assessmentLimits)}
<h2>Как использовать материалы</h2>${list(review.adultProcedure, true)}
<h2>Карта разбора</h2><table><thead><tr><th>Рассказ</th><th>Решение</th><th>Задача</th></tr></thead><tbody>${toc}</tbody></table>
${cards}
<section class="sources"><h2>Основания для решений</h2>${review.sources.map((source) => `<p><a href="${escape(source.url)}">${escape(source.title)}</a></p><p>${escape(source.supports)}</p><p class="muted">Границы: ${escape(source.limit)}</p>`).join("")}</section>
<footer>${escape(review.rights_provenance)}<p>Содержание обзора собирается из исходных текстов и индивидуальных редакторских заключений. Файл: content/reading_short_stories/micro/editorial-review.json.</p></footer>
</main></body></html>`;
const output = new URL("docs/methodology/reading-micro-review.html", root);
await mkdir(new URL("docs/methodology/", root), { recursive: true });
await writeFile(output, html.replace(/[ \t]+$/gm, ""));
console.log(`Built ${fileURLToPath(output)}: ${entries.length} reviewed stories.`);
