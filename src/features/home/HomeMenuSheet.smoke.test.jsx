import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import HomeMenuSheet from "./HomeMenuSheet.jsx";

// Mounts the real component -- HomeMenuSheet is pure props-in, no store/db
// dependency, so this doesn't need any of the mocking other feature smoke
// tests in this app require (same reasoning as TopicTile.smoke.test.jsx).

describe("HomeMenuSheet — mounted through the real component", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.clearAllMocks();
  });

  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<HomeMenuSheet {...props} />);
    });
  }

  function baseProps() {
    return {
      onClose: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenStudents: vi.fn(),
      onOpenSettings: vi.fn(),
    };
  }

  it("renders the three destinations grouped into two sections", () => {
    mount(baseProps());
    const items = Array.from(container.querySelectorAll(".action-sheet__item")).map((el) => el.textContent);
    expect(items).toEqual(["Профиль", "Ученики", "Настройки", "Отмена"]);
    const titles = Array.from(container.querySelectorAll(".action-sheet__title")).map((el) => el.textContent);
    expect(titles).toEqual(["Аккаунт", "Приложение"]);
  });

  it("tapping Ученики calls onOpenStudents and closes the sheet", () => {
    const props = baseProps();
    mount(props);
    const [, studentsBtn] = container.querySelectorAll(".action-sheet__item");
    act(() => { studentsBtn.click(); });
    expect(props.onOpenStudents).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });

  it("tapping the overlay background closes without navigating", () => {
    const props = baseProps();
    mount(props);
    act(() => { container.querySelector(".action-sheet-overlay").click(); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenStudents).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });

  it("Отмена closes without navigating", () => {
    const props = baseProps();
    mount(props);
    const cancelBtn = container.querySelector(".action-sheet__item--cancel");
    act(() => { cancelBtn.click(); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onOpenProfile).not.toHaveBeenCalled();
    expect(props.onOpenStudents).not.toHaveBeenCalled();
    expect(props.onOpenSettings).not.toHaveBeenCalled();
  });
});
