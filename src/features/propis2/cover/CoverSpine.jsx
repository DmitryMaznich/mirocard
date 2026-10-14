import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";

// Half of the spine (coverConfig.js DECORS "spine"): the band is 40 mm of the notebook's paper centred on the fold of the cover's
// sheet. The back is the left half of that sheet and the front the right one, so the back shows the first 20 mm of one page of that
// paper (at its right edge) and the front the next 20 mm (at its left edge): the ruling runs on across the fold. An accent line on the
// band's outer edges.
export default function CoverSpine({ task, half }) {
  return (
    <div className={`p2-spine p2-spine--${half}`} data-testid={`propis2-spine-${half}`} aria-hidden="true">
      <div className="p2-spine-paper"><PrintPageTop task={task} rows={40} /></div>
    </div>
  );
}
