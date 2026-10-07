import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Standalone review of the actual lesson components, without account bootstrap.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(repo, "docs", "design");
await fs.mkdir(destination, { recursive: true });
const scratch = await fs.mkdtemp(path.join(destination, ".coin-preview-"));
try {
  await fs.writeFile(path.join(scratch, "index.html"), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Монеты — просмотр режимов</title><div id="root"></div><script type="module" src="./entry.jsx"></script></html>`);
  await fs.writeFile(path.join(scratch, "entry.jsx"), `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@/styles.css";
import SessionHeader from "@/features/session/SessionHeader.jsx";
import BuildNumberTask from "@/topics/renderers/place_value/BuildNumberTask.jsx";
import IdentifyNumberTask from "@/topics/renderers/place_value/IdentifyNumberTask.jsx";
import RegroupTenTask from "@/topics/renderers/place_value/RegroupTenTask.jsx";
import "./review.css";
function Preview() {
  const [mode, setMode] = useState("build"), [number, setNumber] = useState(13);
  const [approach, setApproach] = useState("group"), [support, setSupport] = useState("learning");
  const [composition, setComposition] = useState(false), [trial, setTrial] = useState(0);
  const actual = mode === "regroup" && number < 10 ? 23 : number;
  const tens = Math.floor(actual / 10), ones = actual % 10;
  const task = { cardId: "preview", conceptId: "preview", number: actual, target: { tens, ones }, model: { tens, ones },
    initial: { tens, ones }, after: { tens: tens - 1, ones: ones + 10 }, buildApproach: approach, askComposition: composition, supportMode: support };
  const Component = mode === "build" ? BuildNumberTask : mode === "read" ? IdentifyNumberTask : RegroupTenTask;
  return <><details className="review-settings"><summary>Настройки просмотра · три режима</summary><div className="review-bar"><strong>Просмотр обновлённых режимов</strong>
    <nav>{[["build", "Собери число"], ["read", "Какое это число?"], ["regroup", "Разменяй десяток"]].map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</nav>
    <label>Число <select value={number} onChange={(e) => setNumber(Number(e.target.value))}>{[7, 13, 23, 30, 99].map((n) => <option key={n}>{n}</option>)}</select></label>
    <label>Уровень <select value={approach} onChange={(e) => setApproach(e.target.value)}><option value="group">Собираем десятки сами</option><option value="ready">Готовые десятки</option></select></label>
    <label>Поддержка <select value={support} onChange={(e) => setSupport(e.target.value)}><option value="learning">Обучение</option><option value="independent">Самостоятельная проба</option></select></label>
    <label><input type="checkbox" checked={composition} onChange={(e) => setComposition(e.target.checked)} /> Спросить состав числа</label>
    <button onClick={() => setTrial((n) => n + 1)}>Начать заново</button>
    <small>Это действующие компоненты из проекта. Настройки сверху относятся только к просмотру. Для размена однозначного числа используется 23.</small>
  </div></details><div className="review-window"><div className="session-screen"><div className="session-header-wrap">
    <SessionHeader topicTitle="Разряды числа" modeTitle={mode === "build" ? "Собери число" : mode === "read" ? "Какое это число?" : "Разменяй десяток"}
      showProgress evaluation="instant" onClose={() => setTrial((n) => n + 1)} onOpenModeSettings={() => { document.querySelector(".review-settings").open = true; }} />
  </div><div className="session-renderer-wrap"><Component key={[mode, actual, approach, support, composition, trial].join("-")} task={task} onCorrect={() => setTrial((n) => n + 1)} /></div></div></div></>;
}
createRoot(document.getElementById("root")).render(<Preview />);
`);
  await fs.writeFile(path.join(scratch, "review.css"), `
* { box-sizing: border-box; } body { margin: 0; font-family: Nunito, sans-serif; color: #203b38; background: #e9eee3; }
button, select { font: inherit; cursor: pointer; } button { border: 1px solid #cdd8c2; } .btn { font: inherit; cursor: pointer; }
.review-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; max-width: 1150px; margin: auto; padding: 18px; }
.review-bar strong { width: 100%; font-size: 22px; } .review-bar nav { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
.review-bar button, select { padding: 9px 12px; border-radius: 12px; background: #fffcf5; color: #203b38; border: 1px solid #cdd8c2; }
.review-bar button[aria-pressed=true] { background: #286b5a; color: white; } .review-bar small { width: 100%; }
.review-settings { max-width: 1150px; margin: auto; } .review-settings summary { cursor: pointer; padding: 14px 18px; min-height: 52px; }
.review-window { max-width: 1100px; height: min(820px, calc(100dvh - 92px)); margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px #25453515; }
.review-window .session-screen { position: relative; inset: auto; width: 100%; height: 100%; z-index: auto; }
@media(max-width: 600px) { .review-window { border-radius: 0; } }
`);
  await build({ configFile: false, root: scratch, plugins: [react(), viteSingleFile()], publicDir: false,
    resolve: { alias: { "@": path.join(repo, "src") } },
    build: { outDir: path.join(scratch, "compiled"), emptyOutDir: true, assetsInlineLimit: 1000000 } });
  const result = path.join(destination, "coin-modes-preview.html");
  await fs.copyFile(path.join(scratch, "compiled", "index.html"), result);
  console.log(result);
} finally {
  // Only remove this freshly created scratch directory inside docs/design.
  const resolved = path.resolve(scratch);
  if (resolved.startsWith(path.resolve(destination) + path.sep) && path.basename(resolved).startsWith(".coin-preview-")) {
    await fs.rm(resolved, { recursive: true, force: true });
  }
}
