import { useCallback, useLayoutEffect, useRef, useState } from "react";

// Shrinks font-size just enough to keep `text` on one line inside its own
// box — vw-based clamp() alone can't do this, since the same font-size
// wraps a long hint ("Прибавь ещё 8") but not a short one ("Убери 2").
// Unlike a one-shot proportional calculation (containerWidth / naturalWidth
// * max), this steps the size DOWN and re-measures after every step,
// verifying the actual fit directly each time rather than trusting a
// single formula — immune to whatever measurement quirk (font metrics,
// rounding, a not-yet-settled layout) made the proportional version report
// "already fits" when it visibly didn't on real devices.
//
// Compares the element's OWN scrollWidth against its OWN clientWidth, not
// against its parent's — the parent (a checklist row) is wider than what's
// actually left for this text once a sibling checkbox + gap + padding are
// accounted for, so measuring against the parent let the loop conclude
// "fits" while the text was still overflowing its own (flex-shrunk) box,
// silently ellipsis-truncating it. That went unnoticed at fingers_count's
// modest 13-17px rows; it became visible once build_number needed a much
// larger (45px) instruction row for a longer phrase on a narrow phone.
// Re-runs on container resize, on any font finishing loading (the Nunito
// stylesheet loads async — see index.html), and via two delayed
// safety-net passes for any layout that only settles a little after mount.
//
// The ref is a callback rather than the usual plain object ref: build_number
// gives every checklist row its own useFitOneLine call so they can all
// share one size ceiling, but rows beyond the first mount well after this
// hook's initial run (once the phase they belong to is reached) — a plain
// ref's `.current` changing doesn't re-trigger the effect, so a row that
// mounted late would keep whatever fontSize the hook computed before it
// existed (the unmeasured `max`) forever. `mountTick` (a plain counter, not
// the DOM node itself) is the reactive dependency that makes the node's
// arrival re-trigger the effect; the node itself stays in a plain ref
// (elRef) since mutating .style on a value sourced from useState directly
// isn't allowed.
export function useFitOneLine(text, { min = 16, max = 56, step = 2 } = {}) {
  const elRef = useRef(null);
  const [mountTick, setMountTick] = useState(0);
  const [fontSize, setFontSize] = useState(max);

  const setRef = useCallback((node) => {
    elRef.current = node;
    setMountTick((t) => t + 1);
  }, []);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;

    function fit() {
      if (parent.clientWidth === 0) return;
      let size = max;
      el.style.fontSize = size + "px";
      while (size > min && el.scrollWidth > el.clientWidth) {
        size -= step;
        el.style.fontSize = size + "px";
      }
      setFontSize(size);
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    const fontsApi = typeof document !== "undefined" ? document.fonts : null;
    fontsApi?.addEventListener?.("loadingdone", fit);
    const t1 = setTimeout(fit, 300);
    const t2 = setTimeout(fit, 1200);
    return () => {
      ro.disconnect();
      fontsApi?.removeEventListener?.("loadingdone", fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mountTick, text, min, max, step]);

  return { ref: setRef, fontSize };
}

// Watches a checklist zone's own rendered height and returns a font-size
// ceiling so `rowsBudget` stacked rows — each with its checkbox, padding,
// and inter-row gap — would still fit inside it, even though usually only
// one or two rows actually exist at once. Feeds into useFitOneLine as the
// upper bound (its `max`): the active row's text still shrinks further from
// there if it's too WIDE to fit on one line, but it can never grow taller
// than this per-row height budget.
export function useRowsHeightCap(rowsBudget = 3, { floor = 14, ceiling = 32, rowChrome = 1.9 } = {}) {
  const ref = useRef(null);
  const [cap, setCap] = useState(ceiling);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      const h = el.clientHeight;
      if (!h) return;
      const perRow = h / rowsBudget / rowChrome;
      setCap(Math.max(floor, Math.min(ceiling, Math.floor(perRow))));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowsBudget, floor, ceiling, rowChrome]);

  return { ref, cap };
}
