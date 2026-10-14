import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";
import { accentColor, leavesLabel } from "./coverConfig.js";
import MironiumLogo from "./MironiumLogo.jsx";
import CoverSpine from "./CoverSpine.jsx";

// The back of the cover (owner, 2026-10-14, as the backs of the printed series): a compact block in the middle — the heading and the
// content written in our own hand on its own paper (coverTasks.js `back`) — white around it; at the foot the number of leaves of
// this notebook, the Mironium logo and the site; the spine's back half at the fold. Same container-query sizing as the front, so the
// preview and the print are one layout.
export default function CoverBack({ cover, back, spineTask = null, leaves = 0, a4 = false }) {
  const kind = back ? cover.back.kind : "none";
  return (
    <div className={`p2-cover p2-back${a4 ? " p2-cover--a4" : ""}${spineTask ? " p2-cover--spine" : ""}`} style={{ "--p2-accent": accentColor(cover.accent) }} data-testid={`propis2-back-${kind}`}>
      {spineTask && <CoverSpine task={spineTask} half="back" />}
      {back && <div className="p2-back-block"><PrintPageTop task={back.task} rows={back.rows} /></div>}
      {leaves > 0 && <div className="p2-back-leaves" data-testid="propis2-back-leaves">{leavesLabel(leaves)}</div>}
      {cover.logo && (
        <div className="p2-back-foot">
          <MironiumLogo className="p2-back-logo" />
          <div className="p2-back-site">mironium.com · © Mironium, {new Date().getFullYear()}</div>
        </div>
      )}
    </div>
  );
}
