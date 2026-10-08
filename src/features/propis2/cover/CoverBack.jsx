import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";
import { accentColor } from "./coverConfig.js";

// The back of the cover: a heading (printed) and the content written in our own hand on its own paper (coverTasks.js `back`).
// Same container-query sizing as the front, so the preview and the print are one layout.
export default function CoverBack({ cover, back, a4 = false }) {
  const kind = back ? cover.back.kind : "none";
  return (
    <div className={`p2-cover p2-back${a4 ? " p2-cover--a4" : ""}`} style={{ "--p2-accent": accentColor(cover.accent) }} data-testid={`propis2-back-${kind}`}>
      {back && (
        <>
          <div className="p2-back-heading">{back.heading}</div>
          <div className="p2-back-page"><PrintPageTop task={back.task} rows={back.fit} /></div>
        </>
      )}
      {back && cover.logo && <div className="p2-cover-logo p2-back-logo">Mironium</div>}
    </div>
  );
}
