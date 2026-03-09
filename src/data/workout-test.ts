import { HOLDS } from "./holds";
import type { HoldDefinition } from "./holds";

// Short-timer version of workout A for manual flow testing on device.
// Accessible via /?test in the URL — not shown in normal picker.
// Uses prefixed hold IDs so weight storage is isolated from workout A.
export const HOLDS_TEST: HoldDefinition[] = HOLDS.slice(0, 3).map((h) => ({
  ...h,
  id: `test-${h.id}`,
  prepSecs: 3,
  hangSecs: 2,
  restSecs: 1,
  breakSecs: 5,
  repsPerSet: 2,
}));
