/**
 * Opens the route's Mountain Project page. A plain https link is deliberate:
 * on a phone with the Mountain Project app installed, the OS hands
 * mountainproject.com links to the app; everywhere else it opens in the browser.
 */
export function MountainProjectLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
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
