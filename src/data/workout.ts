export type { HoldDefinition } from "./holds";
export { HOLDS } from "./holds";
export { HOLDS_B } from "./workout-b";
export { HOLDS_TEST } from "./workout-test";

// Default phase lengths; holds can override each one (see HoldDefinition).
export const PREP_SECS = 10;
export const HANG_SECS = 7;
export const REST_SECS = 3;
export const BREAK_SECS = 180;
