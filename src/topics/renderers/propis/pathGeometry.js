// Minimal SVG path helpers for propis stroke data — only M (moveto) and C (cubic bezier)
// commands ever appear in captured strokes (see handwriting_capture.html's pipeline
// comment: EMA -> RDP -> Hermite -> cubic Bézier -> strokes:[{d}]).

const TOKEN_RE = /[MC]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

export function getPathEndpoints(d) {
  const tokens = d.match(TOKEN_RE) || [];
  let i = 0;
  let cmd = null;
  let start = null;
  let end = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      i += 2;
      if (!start) start = [x, y];
      end = [x, y];
    } else if (cmd === "C") {
      const x = parseFloat(tokens[i + 4]);
      const y = parseFloat(tokens[i + 5]);
      i += 6;
      end = [x, y];
    } else {
      i += 1;
    }
  }

  return { start, end };
}

export function transformPathD(d, { scaleX = 1, translateX = 0, translateY = 0 } = {}) {
  const tokens = d.match(TOKEN_RE) || [];
  const tx = (x) => (x * scaleX + translateX).toFixed(3);
  const ty = (y) => (y + translateY).toFixed(3);

  let out = "";
  let i = 0;
  let cmd = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      out += (out ? " " : "") + t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      out += " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1]));
      i += 2;
    } else if (cmd === "C") {
      out +=
        " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1])) +
        " " + tx(parseFloat(tokens[i + 2])) + " " + ty(parseFloat(tokens[i + 3])) +
        " " + tx(parseFloat(tokens[i + 4])) + " " + ty(parseFloat(tokens[i + 5]));
      i += 6;
    } else {
      i += 1;
    }
  }

  return out;
}
