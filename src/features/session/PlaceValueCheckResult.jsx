import { CHECK_SKILLS, CHECK_VIEWS, checkResultRows } from "@/topics/renderers/place_value/engine.js";

// The result of a place-value check («Проверка: до 100», «Проверка: сотни»)
// for the adult: right first time out of all, by skill and by picture, and what
// to go back to. Read from the session's per-task statistics, counted under
// "skill:picture" (engine.js → generateCheckTasks).
const share = (ok, total) => (total ? ok / total : 1);
const barColor = (ok, total) => (ok === total ? "#16a34a" : share(ok, total) >= 0.5 ? "#f59e0b" : "#dc2626");


export default function PlaceValueCheckResult({ session, modes }) {
  const concepts = session?.statistics?.concepts ?? {};
  const part = String(session?.modeId).endsWith("1000") ? "to1000" : "to100";
  const known = CHECK_SKILLS[part];
  const { skills, views } = checkResultRows(concepts);
  if (!skills.size) return null;
  const total = [...skills.values()].reduce((s, r) => s + r.total, 0);
  const correct = [...skills.values()].reduce((s, r) => s + r.correct, 0);
  const skillRows = known.filter((s) => skills.has(s.key)).map((s) => ({ key: s.key, label: s.label, modeId: s.modeId, ...skills.get(s.key) }));
  const viewRows = Object.keys(CHECK_VIEWS).filter((v) => views.has(v)).map((v) => ({ key: v, label: CHECK_VIEWS[v], ...views.get(v) }));
  // Below 80% right — worth going back to (a skill by its numbered menu item).
  const weakSkills = skillRows.filter((r) => share(r.correct, r.total) < 0.8);
  const weakViews = viewRows.filter((r) => share(r.correct, r.total) < 0.8);
  const modeTitle = (id) => modes?.find((m) => m.id === id)?.ui?.title;
  const bar = (r) => (
    <div key={r.key} className="pvc-row">
      <div className="pvc-label">{r.label}</div>
      <div className="pvc-track"><i style={{ width: `${Math.round(share(r.correct, r.total) * 100)}%`, background: barColor(r.correct, r.total) }} /></div>
      <div className="pvc-count">{r.correct} из {r.total}</div>
    </div>
  );
  return (
    <div className="summary-section pvc">
      <div className="pvc-total">{correct} из {total} <span>с первой попытки</span></div>
      <div className="summary-section-title">По навыкам</div>
      {skillRows.map(bar)}
      {viewRows.length > 0 && <>
        <div className="summary-section-title">По картинкам</div>
        {viewRows.map(bar)}
      </>}
      {(weakSkills.length > 0 || weakViews.length > 0) && (
        <div className="pvc-next">
          Стоит повторить:{" "}
          {[...weakSkills.map((r) => `«${modeTitle(r.modeId) ?? r.label}»`), ...weakViews.map((r) => `картинку «${r.label}»`)].join(", ")}.
        </div>
      )}
    </div>
  );
}
