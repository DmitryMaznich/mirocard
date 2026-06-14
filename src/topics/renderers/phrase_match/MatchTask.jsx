import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./phrase_match.css";

function PoolImage({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!url) return <div style={{ width: "100%", height: "100%", background: "#e0e0e0" }} />;
  return <img src={url} alt="" draggable={false} />;
}

function GhostImage({ topicId, image, x, y, size }) {
  const url = useTopicFile(topicId, image);
  if (!url) return null;
  return (
    <div
      className="pm-ghost"
      style={{ left: x, top: y, width: size, height: size }}
    >
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

function SlotThumb({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!url) return null;
  return <img className="pm-slot__thumb" src={url} alt="" draggable={false} />;
}

export default function MatchTask({ task, topicId, onCorrect, onMistake }) {
  const { items, images } = task;

  // itemId → imageId of placed image
  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null); // { imageId, image, x, y, offsetX, offsetY, size }
  const [hoverSlot, setHoverSlot]   = useState(null);
  const [errorSlot, setErrorSlot]   = useState(null);
  const [done, setDone]             = useState(false);

  const slotRefs      = useRef({});
  const onCorrectRef  = useRef(onCorrect);
  onCorrectRef.current = onCorrect;

  const placedImageIds = new Set(Object.values(placements));

  function getSlotAt(x, y) {
    for (const item of items) {
      const el = slotRefs.current[item.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return item.id;
    }
    return null;
  }

  function handlePointerDown(e, imgEntry) {
    if (done || placedImageIds.has(imgEntry.id) || imgEntry.isDistractor && false) return;
    // don't allow dragging already-placed correct images
    if (placedImageIds.has(imgEntry.id)) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      imageId:  imgEntry.id,
      image:    imgEntry.image,
      isDistractor: imgEntry.isDistractor,
      x:        rect.left,
      y:        rect.top,
      offsetX:  e.clientX - rect.left,
      offsetY:  e.clientY - rect.top,
      size:     rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({
      ...prev,
      x: e.clientX - prev.offsetX,
      y: e.clientY - prev.offsetY,
    }));
    setHoverSlot(getSlotAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const slotId = getSlotAt(e.clientX, e.clientY);
    const { imageId, isDistractor } = dragging;
    setDragging(null);
    setHoverSlot(null);

    if (!slotId) return;

    // Already matched slot — ignore
    if (placements[slotId]) return;

    // Find which item this image belongs to
    const correctItem = items.find(it => it.id === imageId);
    const isCorrect   = !isDistractor && correctItem && correctItem.id === slotId;

    if (!isCorrect) {
      onMistake(slotId, imageId);
      setErrorSlot(slotId);
      setTimeout(() => setErrorSlot(null), 500);
      return;
    }

    const next = { ...placements, [slotId]: imageId };
    setPlacements(next);

    if (Object.keys(next).length === items.length) {
      setDone(true);
      setTimeout(() => onCorrectRef.current(null, null), 600);
    }
  }

  function slotClass(itemId) {
    let cls = "pm-slot";
    if (placements[itemId])    cls += " pm-slot--matched";
    else if (errorSlot === itemId) cls += " pm-slot--error";
    else if (hoverSlot === itemId) cls += " pm-slot--hover";
    return cls;
  }

  return (
    <div
      className="session-body pm-root"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      {/* Left: phrase drop zones */}
      <div className="pm-phrases">
        {items.map(item => (
          <div
            key={item.id}
            ref={el => { slotRefs.current[item.id] = el; }}
            className={slotClass(item.id)}
          >
            {placements[item.id] && (
              <SlotThumb topicId={topicId} image={item.image} />
            )}
            {item.phrase}
          </div>
        ))}
      </div>

      {/* Right: image pool */}
      <div className="pm-pool">
        {images.map(imgEntry => {
          const isPlaced = placedImageIds.has(imgEntry.id);
          return (
            <div
              key={imgEntry.id}
              className={[
                "pm-img-card",
                dragging?.imageId === imgEntry.id ? "pm-img-card--dragging" : "",
                isPlaced ? "pm-img-card--placed" : "",
              ].filter(Boolean).join(" ")}
              onPointerDown={e => handlePointerDown(e, imgEntry)}
            >
              <PoolImage topicId={topicId} image={imgEntry.image} />
            </div>
          );
        })}
      </div>

      {/* Ghost follows pointer */}
      {dragging && (
        <GhostImage
          topicId={topicId}
          image={dragging.image}
          x={dragging.x}
          y={dragging.y}
          size={dragging.size}
        />
      )}
    </div>
  );
}
