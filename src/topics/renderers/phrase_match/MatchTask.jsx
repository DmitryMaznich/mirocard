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
    <div className="pm-ghost pm-ghost--img" style={{ left: x, top: y, width: size, height: size }}>
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

function GhostText({ text, x, y, width, height }) {
  return (
    <div className="pm-ghost pm-ghost--text" style={{ left: x, top: y, width, height }}>
      {text}
    </div>
  );
}

function SlotThumb({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!url) return null;
  return <img className="pm-slot__thumb" src={url} alt="" draggable={false} />;
}

export default function MatchTask({ task, topicId, onCorrect, onIncorrect }) {
  const { items, images, answerType = "image" } = task;
  const isTextMode = answerType === "text";

  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null);
  const [hoverSlot, setHoverSlot]   = useState(null);
  const [errorSlot, setErrorSlot]   = useState(null);
  const [done, setDone]             = useState(false);

  const slotRefs      = useRef({});
  const hadMistake    = useRef(false);
  const onCorrectRef  = useRef(onCorrect);
  const onIncorrectRef = useRef(onIncorrect);
  onCorrectRef.current  = onCorrect;
  onIncorrectRef.current = onIncorrect;

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
    if (done || placedImageIds.has(imgEntry.id)) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      imageId:      imgEntry.id,
      image:        imgEntry.image,
      text:         imgEntry.text,
      isDistractor: imgEntry.isDistractor,
      x:            rect.left,
      y:            rect.top,
      offsetX:      e.clientX - rect.left,
      offsetY:      e.clientY - rect.top,
      width:        rect.width,
      height:       rect.height,
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
    if (placements[slotId]) return;

    const correctItem = items.find(it => it.id === imageId);
    const isCorrect   = !isDistractor && correctItem && correctItem.id === slotId;

    if (!isCorrect) {
      hadMistake.current = true;
      setErrorSlot(slotId);
      setTimeout(() => setErrorSlot(null), 500);
      return;
    }

    const next = { ...placements, [slotId]: imageId };
    setPlacements(next);

    if (Object.keys(next).length === items.length) {
      setDone(true);
      setTimeout(() => {
        if (hadMistake.current) {
          onIncorrectRef.current(null, null);
        } else {
          onCorrectRef.current(null, null);
        }
      }, 600);
    }
  }

  function slotClass(itemId) {
    let cls = "pm-slot";
    if (placements[itemId])        cls += " pm-slot--matched";
    else if (errorSlot === itemId) cls += " pm-slot--error";
    else if (hoverSlot === itemId) cls += " pm-slot--hover";
    return cls;
  }

  // Find the matched answer text for a slot (text mode only)
  function matchedText(itemId) {
    const imgId = placements[itemId];
    if (!imgId) return null;
    return images.find(i => i.id === imgId)?.text ?? null;
  }

  return (
    <div
      className={`session-body pm-root${isTextMode ? " pm-root--text" : ""}`}
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
            {!isTextMode && placements[item.id] && (
              <SlotThumb topicId={topicId} image={item.image} />
            )}
            {isTextMode && placements[item.id] ? (
              <span className="pm-slot__answer">{matchedText(item.id)}</span>
            ) : (
              item.phrase
            )}
          </div>
        ))}
      </div>

      {/* Right: pool */}
      <div className={`pm-pool${isTextMode ? " pm-pool--text" : ""}`}>
        {images.map(imgEntry => {
          const isPlaced = placedImageIds.has(imgEntry.id);
          if (isTextMode) {
            return (
              <div
                key={imgEntry.id}
                className={[
                  "pm-text-card",
                  dragging?.imageId === imgEntry.id ? "pm-text-card--dragging" : "",
                  isPlaced ? "pm-text-card--placed" : "",
                ].filter(Boolean).join(" ")}
                onPointerDown={e => handlePointerDown(e, imgEntry)}
              >
                {imgEntry.text}
              </div>
            );
          }
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
        isTextMode ? (
          <GhostText
            text={dragging.text}
            x={dragging.x}
            y={dragging.y}
            width={dragging.width}
            height={dragging.height}
          />
        ) : (
          <GhostImage
            topicId={topicId}
            image={dragging.image}
            x={dragging.x}
            y={dragging.y}
            size={dragging.width}
          />
        )
      )}
    </div>
  );
}
