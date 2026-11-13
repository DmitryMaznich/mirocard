// Compatibility entrypoint: the drawing workspace is now software Canvas 2D.
process.env.DRAWING_CANVAS_CHECK='model';
await import('./check-first-lines-canvas.mjs');
