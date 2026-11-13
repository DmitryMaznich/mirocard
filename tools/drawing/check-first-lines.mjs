// Compatibility entrypoint: the drawing workspace is now software Canvas 2D.
process.env.DRAWING_CANVAS_CHECK='all';
await import('./check-first-lines-canvas.mjs');
