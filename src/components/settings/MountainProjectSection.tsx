import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  clearMountainProjectUrl,
  getMountainProjectUrl,
  importClimbsFromFile,
  refreshFromMountainProject,
} from "../../lib/mpRefresh";
import { searchMountainProjectUsers } from "../../lib/mpAccount";
import type { MpUser } from "../../lib/mpAccount";
import { LeaveGuardSheet } from "../LeaveGuardSheet";
import { useLeaveGuard } from "../../hooks/useLeaveGuard";

type Props = {
  /** Called after an import replaced the stored climbs. */
  onClimbsChanged?: () => void;
  /** Filled with this section's `allowLeave`, so a page reload elsewhere never asks. */
  allowLeaveRef?: MutableRefObject<() => void>;
};

export function MountainProjectSection({ onClimbsChanged, allowLeaveRef }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(() => getMountainProjectUrl());
  // The URL is only stored once an import with it succeeds.
  const [savedUrl, setSavedUrl] = useState(url);
  const leaveGuard = useLeaveGuard(url.trim() !== savedUrl);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  // null until a search has run; `searched` is the query the results belong to.
  const [results, setResults] = useState<MpUser[] | null>(null);
  const [searched, setSearched] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Bumped by every search, so a slow answer to an old one is dropped.
  const searchSeq = useRef(0);

  const runSearch = async (q: string, existing: MpUser[]) => {
    const seq = ++searchSeq.current;
    setSearchError(null);
    setSearching(true);
    try {
      const page = await searchMountainProjectUsers(q, existing.length);
      if (seq !== searchSeq.current) return;
      const known = new Set(existing.map((u) => u.id));
      const fresh = page.filter((u) => !known.has(u.id));
      setResults([...existing, ...fresh]);
      setSearched(q);
      setHasMore(fresh.length > 0);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) void runSearch(q, []);
  };

  const handlePick = (user: MpUser) => {
    setUrl(user.tickExportUrl);
    setStatus(null);
    setError(null);
  };

  useEffect(() => {
    if (allowLeaveRef) allowLeaveRef.current = leaveGuard.allowLeave;
  });

  const handleRefresh = async () => {
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      const count = await refreshFromMountainProject(url);
      // What got stored is the export URL built from whatever was typed.
      const stored = getMountainProjectUrl();
      setUrl(stored);
      setSavedUrl(stored);
      setStatus(`Imported ${count} climb${count === 1 ? "" : "s"}.`);
      onClimbsChanged?.();
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    clearMountainProjectUrl();
    setUrl("");
    setSavedUrl("");
    setStatus(null);
    setError(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatus(null);
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const count = await importClimbsFromFile(file);
      setStatus(`Imported ${count} climb${count === 1 ? "" : "s"}.`);
      onClimbsChanged?.();
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="py-6 flex flex-col gap-3" data-testid="settings-mountain-project">
      <h2 className="text-white font-semibold text-base">Mountain Project</h2>
      <p className="text-gray-400 text-sm leading-relaxed">
        Pull your ticks in from Mountain Project. Every import{" "}
        <strong className="text-gray-300">replaces all stored climbs</strong> with
        what the export contains.
      </p>
      <ol className="text-gray-500 text-xs leading-relaxed list-decimal list-inside">
        <li>On Mountain Project, make your ticks public</li>
        <li>Search for your name below and pick your account</li>
        <li>Refresh to pull your ticks in</li>
      </ol>

      <form onSubmit={handleSearch} className="flex gap-2" role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your name on Mountain Project"
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

      {searchError && (
        <p className="text-red-400 text-sm" data-testid="settings-mp-search-error">
          {searchError} You can still paste your profile link below.
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
            const picked = url.trim() === user.tickExportUrl;
            return (
              <li key={user.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => handlePick(user)}
                  aria-pressed={picked}
                  className="flex-1 min-w-0 px-4 py-3 text-left active:bg-gray-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
                  data-testid="settings-mp-result"
                >
                  <span className={`block truncate text-sm font-semibold ${picked ? "text-accent-400" : "text-white"}`}>
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {picked ? "Selected · " : ""}
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

      <label className="flex flex-col gap-1.5">
        <span className="text-gray-500 text-xs">
          Or paste a link to your profile, or your user ID
        </span>
        <input
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.mountainproject.com/user/…"
          className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-500/60"
          data-testid="settings-mp-url"
        />
      </label>

      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={handleRefresh}
          disabled={busy || !url.trim()}
          className="w-full py-3 rounded-lg bg-accent-500 active:bg-accent-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 flex items-center justify-center gap-2"
          data-testid="settings-mp-refresh"
        >
          {busy && (
            <svg
              className="animate-spin h-4 w-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {busy ? "Refreshing…" : "Refresh from Mountain Project"}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex-1 py-3 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            data-testid="settings-mp-file"
          >
            Upload CSV…
          </button>
          <button
            onClick={handleClear}
            disabled={busy || !url}
            className="px-5 py-3 rounded-lg bg-gray-800 active:bg-gray-700 border border-gray-700 disabled:text-gray-600 disabled:border-gray-800 text-gray-200 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            data-testid="settings-mp-clear"
          >
            Clear
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {status && (
        <p className="text-accent-300 text-sm" data-testid="settings-mp-status">{status}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm" data-testid="settings-mp-error">{error}</p>
      )}
      <LeaveGuardSheet guard={leaveGuard} lost="The Mountain Project account you entered" />
    </section>
  );
}
