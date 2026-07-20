import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import AnimatedHand from "./AnimatedHand.jsx";
import { HAND_PATHS, FINGER_TIPS_R, FINGER_BASES_R } from "./handShapes.js";

describe("handShapes data shape", () => {
  it("has fill+line paths for all six poses", () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(HAND_PATHS[n].fill.length).toBeGreaterThan(50);
      expect(HAND_PATHS[n].line.length).toBeGreaterThan(50);
    }
  });

  it("has one tip per raised finger, count matching the pose", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(FINGER_TIPS_R[n]).toHaveLength(n);
      for (const p of FINGER_TIPS_R[n]) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(1);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(1);
      }
    }
  });

  it("has 5-slot [thumb,index,middle,ring,pinky] base rows with nulls for raised fingers", () => {
    for (const n of [0, 1, 2, 3, 4]) {
      expect(FINGER_BASES_R[n]).toHaveLength(5);
    }
  });
});

describe("AnimatedHand", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(el) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(el));
  }

  it("renders a single SVG layer for each count without throwing", () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      mount(<AnimatedHand count={n} side="right" animated={false} />);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
      act(() => root.unmount());
      container.remove();
    }
    root = null; container = null;
  });

  it("mirrors the left hand via a transform group", () => {
    mount(<AnimatedHand count={3} side="left" animated={false} />);
    const g = container.querySelector("g");
    expect(g.getAttribute("transform")).toBe("translate(256,0) scale(-1,1)");
  });

  it("clamps out-of-range counts", () => {
    mount(<AnimatedHand count={9} side="right" animated={false} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
