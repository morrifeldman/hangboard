import { useEffect, useState } from "react";

/**
 * Which tap-to-edit cell (see WeightCell) is open, by key. Only one opens at a
 * time, and a tap anywhere outside a cell or Escape closes it.
 */
export function useOpenCell() {
  const [openCell, setOpenCell] = useState<string | null>(null);
  useEffect(() => {
    if (!openCell) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest("[data-weight-cell]")) {
        setOpenCell(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [openCell]);
  return [openCell, setOpenCell] as const;
}
