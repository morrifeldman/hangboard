// `?test` is read once, at boot, and never again.
//
// The router owns the URL now, and a navigation that doesn't carry the query
// string forward would otherwise switch test mode off underneath a session that
// started in it. Capturing the flag here makes the mode a property of how the
// app was opened rather than of whatever URL happens to be showing.
export const IS_TEST_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("test");
