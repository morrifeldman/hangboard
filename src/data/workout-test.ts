import { HOLDS } from "./holds";
import type { HoldDefinition } from "./holds";

// Short-timer version of workout A for manual flow testing on device.
// Accessible via /?test in the URL — not shown in normal picker.
// Shares hold IDs (and therefore weight storage) with workout A.
export const HOLDS_TEST: HoldDefinition[] = HOLDS.map((h) => ({
  ...h,
  prepSecs: 3,
  hangSecs: 2,
  restSecs: 1,
  breakSecs: 5,
  repsPerSet: 2,
}));
