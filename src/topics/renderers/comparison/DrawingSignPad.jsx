import { useState, useRef, useEffect } from "react";

export default function DrawingSignPad({ taskKey, onSignRecognized, disabled, shake }) {
  const canvasRef    = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [overlaySign, setOverlaySign] = useState(null);
  const strokesRef   = useRef([]);
  const timerRef     = useRef(null);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    strokesRef.current = [];
    setOverlaySign(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(() => { clearCanvas(); }, [taskKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth   = 14;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#2d6fb5";
  }, [taskKey, overlaySign]);

  function getCoords(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function onPointerDown(e) {
    if (disabled) return;
    if (overlaySign) clearCanvas();
    setIsDrawing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (timerRef.current) clearTimeout(timerRef.current);
    const coords = getCoords(e);
    strokesRef.current.push([coords]);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }

  function onPointerMove(e) {
    if (!isDrawing || disabled) return;
    const coords = getCoords(e);
    strokesRef.current[strokesRef.current.length - 1].push(coords);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    timerRef.current = setTimeout(() => {
      const sign = recognizeSign(strokesRef.current);
      setOverlaySign(sign);
      onSignRecognized(sign, clearCanvas);
    }, 700);
  }

  return (
    <div className={`draw-sign-pad-wrapper${shake ? " croc-put-sign-btn--shake" : ""}`}>
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="draw-sign-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {overlaySign && (
        <div className={`draw-sign-overlay ${overlaySign === "?" ? "error" : "success"}`}>
          {overlaySign}
        </div>
      )}
    </div>
  );
}

function recognizeSign(strokes) {
  if (!strokes || strokes.length === 0) return null;

  if (strokes.length === 2) {
    const getBounds = (s) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      s.forEach((p) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
      return { width: maxX - minX, height: maxY - minY };
    };
    const b1 = getBounds(strokes[0]);
    const b2 = getBounds(strokes[1]);
    if (b1.width > b1.height * 1.5 && b2.width > b2.height * 1.5) return "=";
    return "?";
  }

  if (strokes.length === 1) {
    const pts = strokes[0];
    if (pts.length < 5) return "?";
    let minX = Infinity, maxX = -Infinity, minXIdx = -1, maxXIdx = -1;
    pts.forEach((p, i) => {
      if (p.x < minX) { minX = p.x; minXIdx = i; }
      if (p.x > maxX) { maxX = p.x; maxXIdx = i; }
    });
    const startX = pts[0].x;
    const endX   = pts[pts.length - 1].x;
    const isMinInMiddle = minXIdx > pts.length * 0.1 && minXIdx < pts.length * 0.9;
    if (isMinInMiddle && startX > minX + 20 && endX > minX + 20) return "<";
    const isMaxInMiddle = maxXIdx > pts.length * 0.1 && maxXIdx < pts.length * 0.9;
    if (isMaxInMiddle && startX < maxX - 20 && endX < maxX - 20) return ">";
  }

  return "?";
}
