export type { HoldDefinition } from "./holds";
export { HOLDS } from "./holds";
export { HOLDS_B } from "./workout-b";

export const PREP_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 1 : 10;
export const HANG_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 1 : 7;
export const REST_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 1 : 3;
export const BREAK_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 5 : 180;
export const SET1_REPS = import.meta.env.VITE_TEST_MODE === "true" ? 3 : 7;
export const SET2_REPS = import.meta.env.VITE_TEST_MODE === "true" ? 2 : 6;
