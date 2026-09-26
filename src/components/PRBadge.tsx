/** Amber, not accent: a PR is an achievement to notice, not something to tap. */
export function PRBadge({ count = 1 }: { count?: number }) {
  return (
    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/40">
      {count > 1 ? `${count} PRs` : "PR"}
    </span>
  );
}
