const MP_ANDROID_PACKAGE = "com.mountainproject.android";

/**
 * An Android intent link that opens `url` in the Mountain Project app, or in
 * the browser (via `S.browser_fallback_url`) when the app isn't installed.
 */
export function mountainProjectIntentUrl(url: string): string {
  const u = new URL(url);
  return (
    `intent://${u.host}${u.pathname}${u.search}` +
    `#Intent;scheme=https;package=${MP_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(url)};end`
  );
}
