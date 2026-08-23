import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { recognizeSign, DRAW_SPACE } from "./signRecognition";

// Backing-store resolution follows the canvas's real displayed CSS size *
// devicePixelRatio, so lines stay crisp on retina screens instead of being
// upscaled from a fixed 300x300 bitmap. A transform maps the DRAW_SPACE
// logical grid onto that physical resolution, so drawing/recognition code
// never has to know about DPR or the actual display size.
function syncCanvasResolution(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const targetWidth  = Math.max(1, Math.round(rect.width * dpr));
  const targetHeight = Math.max(1, Math.round(rect.height * dpr));
  // Reassigning canvas.width/height clears the bitmap, so only do it when
  // the physical size actually changed (not on every style resync).
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width  = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(targetWidth / DRAW_SPACE, 0, 0, targetHeight / DRAW_SPACE, 0, 0);
  ctx.lineWidth   = 14;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.strokeStyle = "#2d6fb5";
}

export default function DrawingSignPad({ taskKey, onSignRecognized, disabled, shake }) {
  const canvasRef    = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [overlaySign, setOverlaySign] = useState(null);
  const strokesRef   = useRef([]);
  const timerRef     = useRef(null);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    strokesRef.current = [];
    setOverlaySign(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasResolution(canvas);
    clearCanvas();
  }, [taskKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handleResize() { syncCanvasResolution(canvas); }
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  function getCoords(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (DRAW_SPACE / rect.width),
      y: (e.clientY - rect.top)  * (DRAW_SPACE / rect.height),
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
