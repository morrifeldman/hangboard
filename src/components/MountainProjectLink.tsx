import { mountainProjectIntentUrl } from "../lib/mountainProjectLink";

const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/**
 * Opens the route's Mountain Project page. On Android it goes through an
 * intent link so the app opens when it's installed; elsewhere it's a plain
 * https link (iOS hands those to the app itself when it claims them).
 */
export function MountainProjectLink({ url, className = "" }: { url: string; className?: string }) {
  // An intent link navigates out to the app, so it must not open a blank tab first.
  const linkProps = isAndroid
    ? { href: mountainProjectIntentUrl(url) }
    : { href: url, target: "_blank", rel: "noopener noreferrer" };
  return (
    <a
      {...linkProps}
      className={`inline-flex items-center gap-1 text-sm text-accent-400 hover:text-accent-300 ${className}`}
    >
      Mountain Project
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
    </a>
  );
}
