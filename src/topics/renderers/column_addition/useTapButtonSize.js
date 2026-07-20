import { useState, useEffect } from "react";

// Shared by every col-tap-kb style keyboard (Столбик, Считаем на пальцах) so
// they scale up together at tablet width instead of each hand-rolling it.
export function useTapButtonSize(btnSize) {
  const [isTablet, setIsTablet] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsTablet(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isTablet ? Math.round(btnSize * 1.5) : btnSize;
}
