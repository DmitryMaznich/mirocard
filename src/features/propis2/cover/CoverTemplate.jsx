import { FIELDS, accentColor, coverTitle, presetOf } from "./coverConfig.js";
import MironiumLogo from "./MironiumLogo.jsx";
import CoverSpine from "./CoverSpine.jsx";

// The front of the cover, drawn from a cover config (coverConfig.js) and the notebook. One component for the print (an A5 / A4 page)
// and the previews: every size is a share of the cover's own width (container query units), so the preview is the cover itself, only
// smaller. «ТЕТРАДЬ» always, the name printed under it. Pure: the engine tasks (the spine's paper) come in ready (coverTasks.js).
export default function CoverTemplate({ cover, title, tasks = {}, a4 = false }) {
  const name = coverTitle(cover, title);
  const { decor } = cover;
  const preset = presetOf(cover);
  return (
    <div
      className={`p2-cover${a4 ? " p2-cover--a4" : ""}${tasks.spineTask ? " p2-cover--spine" : ""}`}
      style={{ "--p2-accent": accentColor(cover.accent) }}
      data-testid={`propis2-cover-${preset ?? "custom"}`}
      data-decor={decor}
    >
      {tasks.spineTask && <CoverSpine task={tasks.spineTask} half="front" />}
      <div className="p2-cover-mid">
        <div className="p2-cover-kicker">ТЕТРАДЬ</div>
        <div className="p2-cover-name">{name}</div>
        {cover.fields.length > 0 && (
          <div className="p2-cover-fields">
            {FIELDS.filter((f) => cover.fields.includes(f.id)).map((f) => <div key={f.id} className="p2-cover-field"><span>{f.label}</span><i /></div>)}
          </div>
        )}
      </div>
      {cover.logo && <MironiumLogo className="p2-cover-logo" />}
    </div>
  );
}
