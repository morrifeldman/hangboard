export type { HoldDefinition } from "./holds";
export { HOLDS } from "./holds";

export const PREP_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 3 : 10;
export const HANG_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 2 : 7;
export const REST_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 1 : 3;
export const BREAK_SECS = import.meta.env.VITE_TEST_MODE === "true" ? 5 : 180;
