import { act } from "react";
import { createRoot } from "react-dom/client";
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import PrintPageView from "../propis/PrintPageView.jsx";
import { buildPageTask } from "./pageTask.js";

// For each word (a pair of letters) renders the real notebook page and reports the distance between the END of the connector (the 4-point stroke that
// leaves the lowest point) and the START of the stroke that follows it, in page units.  KK_GLYPHS: glyphs json, KK_WORDS: ["әл", ...], KK_OUT: result json.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("pairs", () => {
  if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
  const kk = JSON.parse(readFileSync(process.env.KK_GLYPHS, "utf-8"));
  const labels = new Set(kk.map((g) => g.label));
  const topicRecord = { wide: [...wide.filter((g) => !labels.has(g.label)), ...kk], elements: [], meta: { script: { growJoins: true, topJoins: true } } };
  const res = {};
  for (const w of JSON.parse(process.env.KK_WORDS)) {
    const task = buildPageTask({ topicRecord, lines: [w], grid: "regular" });
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<PrintPageView task={task} onClose={() => {}} />));
    const svg = host.querySelector("svg.propis-print-page-svg");
    const paths = [...svg.querySelectorAll("path")].filter((p) => p.getAttribute("stroke") === "#1d4ed8").map((p) => p.getAttribute("d"));
    const nums = (d) => (d.match(/-?\d+\.?\d*/g) || []).map(Number);
    const first = [];
    for (const d of paths) { const n = nums(d); if (first.length && Math.abs(n[0] - nums(first[0])[0]) < 1e-6 && Math.abs(n[1] - nums(first[0])[1]) < 1e-6) break; first.push(d); }
    if (process.env.KK_MODE === "turn") {
      // the turn at the join: the direction the exit arrives (its last cubic's end tangent) against the direction the next stroke leaves its start (its first cubic's start tangent)
      const e = nums(first[0]); const n2 = nums(first[1]);
      const a = Math.atan2(e[e.length - 1] - e[e.length - 3], e[e.length - 2] - e[e.length - 4]);
      const b = Math.atan2(n2[3] - n2[1], n2[2] - n2[0]);
      let t = ((b - a) * 180) / Math.PI; while (t > 180) t -= 360; while (t < -180) t += 360;
      res[w] = { turn: t, arrive: (a * 180) / Math.PI, leave: (b * 180) / Math.PI }; act(() => root.unmount()); host.remove(); continue;
    }
    if (process.env.KK_MODE === "exit") {
      // a letter drawn as ONE stroke whose end is its exit: the distance from that end to the start of the next stroke
      const e = nums(first[0]); const n2 = nums(first[1]);
      res[w] = { gap: Math.hypot(e[e.length - 2] - n2[0], e[e.length - 1] - n2[1]), exitEnd: e.slice(-2), nextStart: n2.slice(0, 2) };
      act(() => root.unmount()); host.remove(); continue;
    }
    if (process.env.KK_MODE === "before") {
      // the LAST letter is the one the connector must reach: its body is the last stroke; the distance from its start to the ink before it
      const pts = (d) => { const n = nums(d); const P = []; for (let i = 0; i < n.length; i += 2) P.push([n[i], n[i + 1]]); const out = [P[0]]; for (let j = 1; j + 2 < P.length; j += 3) for (let k = 1; k <= 12; k += 1) { const t = k / 12, u = 1 - t; out.push([u * u * u * P[j - 1][0] + 3 * u * u * t * P[j][0] + 3 * u * t * t * P[j + 1][0] + t * t * t * P[j + 2][0], u * u * u * P[j - 1][1] + 3 * u * u * t * P[j][1] + 3 * u * t * t * P[j + 1][1] + t * t * t * P[j + 2][1]]); } return out; };
      const last = first[first.length - 1]; const st = nums(last).slice(0, 2);
      let best = Infinity; for (const d of first.slice(0, -1)) for (const q of pts(d)) best = Math.min(best, Math.hypot(q[0] - st[0], q[1] - st[1]));
      res[w] = { gap: best }; act(() => root.unmount()); host.remove(); continue;
    }
    const ti = first.findIndex((d, i) => i > 0 && nums(d).length >= 8 && nums(d)[1] > 60 && nums(d)[0] < nums(first[0])[0] + 60);
    if (ti < 0 || ti + 1 >= first.length) { res[w] = null; act(() => root.unmount()); host.remove(); continue; }
    const tn = nums(first[ti]); const nn = nums(first[ti + 1]);
    res[w] = { gap: Math.hypot(tn[tn.length - 2] - nn[0], tn[tn.length - 1] - nn[1]), tailEnd: tn.slice(-2), nextStart: nn.slice(0, 2) };
    act(() => root.unmount()); host.remove();
  }
  writeFileSync(process.env.KK_OUT, JSON.stringify(res));
});
