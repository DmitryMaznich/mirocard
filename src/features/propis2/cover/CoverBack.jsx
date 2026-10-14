import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";
import { accentColor } from "./coverConfig.js";
import MironiumLogo from "./MironiumLogo.jsx";

// The back of the cover (owner, 2026-10-14, as the backs of the printed series): a compact block in the middle — the heading and the
// content written in our own hand on its own paper (coverTasks.js `back`) — white around it, the Mironium logo and the site at the foot.
// Same container-query sizing as the front, so the preview and the print are one layout.
export default function CoverBack({ cover, back, a4 = false }) {
  const kind = back ? cover.back.kind : "none";
  return (
    <div className={`p2-cover p2-back${a4 ? " p2-cover--a4" : ""}`} style={{ "--p2-accent": accentColor(cover.accent) }} data-testid={`propis2-back-${kind}`}>
      {back && <div className="p2-back-block"><PrintPageTop task={back.task} rows={back.rows} /></div>}
      {cover.logo && (
        <div className="p2-back-foot">
          <MironiumLogo className="p2-back-logo" />
          <div className="p2-back-site">mironium.com · © Mironium, {new Date().getFullYear()}</div>
        </div>
      )}
    </div>
  );
}
