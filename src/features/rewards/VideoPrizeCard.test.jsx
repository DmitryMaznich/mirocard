import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUiLanguage } from "@/shared/i18n/uiLanguage";
import VideoPrizeCard from "./VideoPrizeCard";

describe("video prize disclosure across lesson settings", () => {
  let root, host;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    setUiLanguage("ru");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  const prizeSwitch = () => host.querySelector('[role="switch"][aria-label="Видеоприз"]');
  const switches = (label) => host.querySelector(`[role="switch"][aria-label="${label}"]`);
  const settings = () => document.getElementById(prizeSwitch().getAttribute("aria-controls"));

  it("starts folded when disabled, including rules and notes", () => {
    act(() => root.render(<VideoPrizeCard enabled={false} onEnabled={vi.fn()}
      showStrict showAtEnd rules={{ lossMode: "all" }} note="Примечание" />));
    expect(prizeSwitch().getAttribute("aria-checked")).toBe("false");
    expect(settings().hidden).toBe(true);
    expect(settings().contains(host.querySelector(".video-prize-card__foot"))).toBe(true);
    expect(host.querySelectorAll(".enum-btn")).toHaveLength(3); // Preserved, not unmounted.
    expect(host.querySelectorAll(".enum-btn:disabled")).toHaveLength(3);
  });

  it("starts expanded when enabled and changes no values just by rendering", () => {
    const onEnabled = vi.fn(); const onAnswersPerStar = vi.fn();
    act(() => root.render(<VideoPrizeCard enabled onEnabled={onEnabled}
      showStrict strict={false} showAtEnd atEnd answersPerStar={3} onAnswersPerStar={onAnswersPerStar} />));
    expect(settings().hidden).toBe(false);
    expect(host.querySelector(".enum-btn--active").textContent).toBe("15");
    expect(switches("Строгий подсчёт").getAttribute("aria-checked")).toBe("false");
    expect(switches("Показать в конце занятия").getAttribute("aria-checked")).toBe("true");
    expect(onEnabled).not.toHaveBeenCalled();
    expect(onAnswersPerStar).not.toHaveBeenCalled();
  });

  it("retains edited settings and the mounted controls through off/on", () => {
    function Lesson() {
      const [enabled, setEnabled] = useState(true);
      const [answers, setAnswers] = useState(1);
      const [strict, setStrict] = useState(true);
      const [atEnd, setAtEnd] = useState(false);
      return <VideoPrizeCard enabled={enabled} onEnabled={setEnabled}
        answersPerStar={answers} onAnswersPerStar={setAnswers}
        showStrict strict={strict} onStrict={setStrict} showAtEnd atEnd={atEnd} onAtEnd={setAtEnd} />;
    }
    act(() => root.render(<Lesson />));
    act(() => [...host.querySelectorAll(".enum-btn")].find((button) => button.textContent === "15").click());
    act(() => switches("Строгий подсчёт").click());
    act(() => switches("Показать в конце занятия").click());
    const before = settings();
    act(() => prizeSwitch().click());
    expect(settings().hidden).toBe(true);
    act(() => prizeSwitch().click());
    expect(settings()).toBe(before);
    expect(settings().hidden).toBe(false);
    expect(host.querySelector(".enum-btn--active").textContent).toBe("15");
    expect(switches("Строгий подсчёт").getAttribute("aria-checked")).toBe("false");
    expect(switches("Показать в конце занятия").getAttribute("aria-checked")).toBe("true");
  });

  it("follows externally restored enabled state without resetting the settings", () => {
    const props = { onEnabled: vi.fn(), answersPerStar: 2, showStrict: true, strict: false };
    act(() => root.render(<VideoPrizeCard {...props} enabled={false} />));
    expect(settings().hidden).toBe(true);
    act(() => root.render(<VideoPrizeCard {...props} enabled />));
    expect(settings().hidden).toBe(false);
    expect(host.querySelector(".enum-btn--active").textContent).toBe("10");
    expect(switches("Строгий подсчёт").getAttribute("aria-checked")).toBe("false");
  });

  it("retains chat's note-only variant and optional rows", () => {
    act(() => root.render(<VideoPrizeCard enabled onEnabled={vi.fn()} showSeries={false}
      note="Видеоприз — на экране завершения." />));
    expect(settings().hidden).toBe(false);
    expect(host.querySelectorAll(".enum-btn")).toHaveLength(0);
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(1);
    expect(settings().textContent).toContain("на экране завершения");
  });

  it("keeps header help available while folded and uses distinct panel IDs", () => {
    const onShowInfo = vi.fn();
    act(() => root.render(<><VideoPrizeCard enabled={false} onEnabled={vi.fn()} onShowInfo={onShowInfo} />
      <VideoPrizeCard enabled onEnabled={vi.fn()} /></>));
    const controls = [...host.querySelectorAll('.video-prize-card__head [role="switch"]')].map((button) => button.getAttribute("aria-controls"));
    expect(new Set(controls).size).toBe(2);
    expect(controls.every((id) => document.getElementById(id))).toBe(true);
    act(() => host.querySelector(".video-prize-card__head .param-info-btn").click());
    expect(onShowInfo).toHaveBeenCalledWith(expect.objectContaining({ title: "Видеоприз" }));
  });
});
