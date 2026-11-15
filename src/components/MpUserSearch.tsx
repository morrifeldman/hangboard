import { useRef, useState } from "react";
import { searchMountainProjectUsers } from "../lib/mpAccount";
import type { MpUser } from "../lib/mpAccount";

type Props = {
  onPick: (user: MpUser) => void;
  /** Marks a result as already chosen (accent name, `pickedLabel` before its id). */
  isPicked?: (user: MpUser) => boolean;
  pickedLabel?: string;
  /** Stops results being picked, e.g. while the last pick is still loading. */
  disabled?: boolean;
  /** Appended to a failed search's message: what to do instead. */
  failureHint?: string;
  placeholder?: string;
};

/** Search Mountain Project accounts by name and pick one from the results. */
export function MpUserSearch({
  onPick,
  isPicked,
  pickedLabel = "Selected",
  disabled = false,
  failureHint = "",
  placeholder = "Your name on Mountain Project",
}: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  // null until a search has run; `searched` is the query the results belong to.
  const [results, setResults] = useState<MpUser[] | null>(null);
  const [searched, setSearched] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by every search, so a slow answer to an old one is dropped.
  const seqRef = useRef(0);

  const runSearch = async (q: string, existing: MpUser[]) => {
    const seq = ++seqRef.current;
    setError(null);
    setSearching(true);
    try {
      const page = await searchMountainProjectUsers(q, existing.length);
      if (seq !== seqRef.current) return;
      const known = new Set(existing.map((u) => u.id));
      const fresh = page.filter((u) => !known.has(u.id));
      setResults([...existing, ...fresh]);
      setSearched(q);
      setHasMore(fresh.length > 0);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === seqRef.current) setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) void runSearch(q, []);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-2" role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search Mountain Project accounts by name"
          autoCapitalize="words"
          autoCorrect="off"
          enterKeyHint="search"
          className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-500/60"
          data-testid="settings-mp-search"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 h-10 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          data-testid="settings-mp-search-submit"
        >
          {searching && results === null ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p className="text-red-400 text-sm" data-testid="settings-mp-search-error">
          {error} {failureHint}
        </p>
      )}
      {results && results.length === 0 && (
        <p className="text-gray-400 text-sm" data-testid="settings-mp-search-empty">
          No accounts found for &ldquo;{searched}&rdquo;.
        </p>
      )}
      {results && results.length > 0 && (
        <ul
          className="rounded-2xl bg-gray-800/60 divide-y divide-gray-700/60 overflow-hidden"
          data-testid="settings-mp-results"
        >
          {results.map((user) => {
            const picked = isPicked?.(user) ?? false;
            return (
              <li key={user.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onPick(user)}
                  disabled={disabled}
                  aria-pressed={picked}
                  className="flex-1 min-w-0 px-4 py-3 text-left active:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
                  data-testid="settings-mp-result"
                >
                  <span className={`block truncate text-sm font-semibold ${picked ? "text-accent-400" : "text-white"}`}>
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {picked ? `${pickedLabel} · ` : ""}
                    {user.location || `User ${user.id}`}
                  </span>
                </button>
                <a
                  href={user.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 text-xs font-semibold text-gray-300 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
                  aria-label={`View ${user.name}'s Mountain Project profile`}
                >
                  Profile
                </a>
              </li>
            );
          })}
          {hasMore && (
            <li>
              <button
                type="button"
                onClick={() => void runSearch(searched, results)}
                disabled={searching}
                className="w-full px-4 py-3 text-sm font-semibold text-gray-300 disabled:text-gray-600 active:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
                data-testid="settings-mp-more"
              >
                {searching ? "Loading…" : "Show more"}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
