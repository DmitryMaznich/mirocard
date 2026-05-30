import { useState, useRef, useCallback, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import "./narrative.css";

function useSceneAssets(topicId, cards) {
  const [imageUrls, setImageUrls] = useState({});
  const [audioUrls, setAudioUrls] = useState({});

  useEffect(() => {
    if (!topicId || !cards?.length) return;
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const imgs = {};
      const auds = {};
      for (const card of cards) {
        // image
        if (card.imageUrl) {
          imgs[card.id] = card.imageUrl;
        } else if (card.image) {
          const blob = await topics.getFile(db, topicId, card.image);
          if (blob && !cancelled) imgs[card.id] = URL.createObjectURL(blob);
        }
        // audio
        const audioId = card.params?.audioId;
        if (audioId) {
          const blob = await topics.getFile(db, topicId, `audio/${audioId}.mp3`);
          if (blob && !cancelled) auds[card.id] = URL.createObjectURL(blob);
        }
        if (cancelled) return;
      }
      if (!cancelled) { setImageUrls(imgs); setAudioUrls(auds); }
    })();
    return () => { cancelled = true; };
  }, [topicId, cards]);

  return { imageUrls, audioUrls };
}

export default function StorySequence({ task, topicRecord, soundEnabled, onMistake, onCorrect, onAdvance }) {
  const sequence     = task?.sequence    ?? [];
  const correctOrder = task?.correctOrder ?? [];
  const conceptId    = task?.conceptId   ?? "unknown";
  const topicId      = topicRecord?.meta?.id;
  const cards        = topicRecord?.cards ?? [];

  const { imageUrls, audioUrls } = useSceneAssets(topicId, cards);

  function getImage(sceneId) {
    const card = cards.find((c) => c.id === sceneId);
    return imageUrls[sceneId] ?? card?.imageUrl ?? card?.image ?? "";
  }

  const [shuffled,    setShuffled]  = useState(() => [...sequence].map((s) => s.id).sort(() => Math.random() - 0.5));
  const [slots,       setSlots]     = useState(() => Array(correctOrder.length).fill(null));
  const [dragging,    setDragging]  = useState(null);
  const [shakingSlot, setShaking]   = useState(null);
  const [done,        setDone]      = useState(false);

  const pointerIdRef = useRef(null);
  const screenRef    = useRef(null);
  const slotRefs     = useRef([]);
  const advTimerRef  = useRef(null);

  useEffect(() => () => { if (advTimerRef.current) clearTimeout(advTimerRef.current); }, []);

  const sceneMap  = Object.fromEntries(sequence.map((s) => [s.id, s]));
  const nextSlot  = slots.findIndex((s) => s === null);
  const question  = done || nextSlot < 0 ? null : nextSlot === 0 ? "Что сначала?" : "Что потом?";

  function detectSlot(x, y) {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }

  const handlePointerDown = useCallback((e, sceneId) => {
    e.preventDefault();
    try { screenRef.current?.setPointerCapture(e.pointerId); } catch {}
    pointerIdRef.current = e.pointerId;
    setDragging({ sceneId, x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragging || e.pointerId !== pointerIdRef.current) return;
    setDragging((d) => ({ ...d, x: e.clientX, y: e.clientY }));
  }, [dragging]);

  const handlePointerEnd = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current || !dragging) return;
    const { sceneId } = dragging;
    setDragging(null);
    pointerIdRef.current = null;

    const slotIdx = detectSlot(e.clientX, e.clientY);
    if (slotIdx === null) return;
    if (slots[slotIdx] !== null) return;

    if (correctOrder[slotIdx] === sceneId) {
      const next = [...slots];
      next[slotIdx] = sceneId;
      setSlots(next);
      setShuffled((s) => s.filter((id) => id !== sceneId));
      if (next.every((s) => s !== null)) {
        setDone(true);
        onCorrect?.(conceptId, conceptId);
        advTimerRef.current = setTimeout(() => onAdvance?.(), 1200);
      }
    } else {
      setShaking(slotIdx);
      onMistake?.(sceneId, sceneId);
      setTimeout(() => setShaking(null), 450);
    }
  }, [dragging, slots, correctOrder, onCorrect, onMistake, onAdvance]);

  function playAudio(sceneId) {
    if (!soundEnabled) return;
    const url = audioUrls[sceneId];
    if (!url) return;
    new Audio(url).play().catch(() => {});
  }

  return (
    <div
      ref={screenRef}
      className="ns-screen"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {question && (
        <div key={question} className="ns-question">{question}</div>
      )}

      <div className="ns-slots">
        {correctOrder.map((_, idx) => {
          const placedId = slots[idx];
          const isShaking = shakingSlot === idx;
          return (
            <div
              key={idx}
              ref={(el) => { slotRefs.current[idx] = el; }}
              className={`ns-slot${placedId ? " ns-slot--filled" : ""}${isShaking ? " ns-slot--shake" : ""}${done ? " ns-slot--done" : ""}`}
            >
              {placedId ? (
                <>
                  <img src={getImage(placedId)} alt={sceneMap[placedId]?.label?.ru ?? ""} draggable={false} />
                  <span>{sceneMap[placedId]?.label?.ru ?? sceneMap[placedId]?.caption?.ru ?? ""}</span>
                </>
              ) : (
                <span className="ns-slot-num">{idx + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ns-bank">
        {shuffled.map((sceneId) => {
          const scene = sceneMap[sceneId];
          return (
            <div
              key={sceneId}
              className="ns-card"
              onPointerDown={(e) => handlePointerDown(e, sceneId)}
              onClick={() => playAudio(sceneId)}
            >
              <img src={getImage(sceneId)} alt={scene?.label?.ru ?? scene?.caption?.ru ?? sceneId} draggable={false} />
              <span>{scene?.label?.ru ?? scene?.caption?.ru ?? sceneId}</span>
            </div>
          );
        })}
      </div>



      {dragging && (
        <div
          className="ns-card ns-card--floating"
          style={{ left: dragging.x, top: dragging.y }}
        >
          <img src={getImage(dragging.sceneId)} alt="" draggable={false} />
          <span>{sceneMap[dragging.sceneId]?.caption?.ru ?? ""}</span>
        </div>
      )}
    </div>
  );
}
