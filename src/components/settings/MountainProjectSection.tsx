import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  clearMountainProjectUrl,
  getMountainProjectUrl,
  importClimbsFromFile,
  refreshFromMountainProject,
} from "../../lib/mpRefresh";
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

  useEffect(() => {
    if (allowLeaveRef) allowLeaveRef.current = leaveGuard.allowLeave;
  });

  const handleRefresh = async () => {
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      const count = await refreshFromMountainProject(url);
      setUrl(url.trim());
      setSavedUrl(url.trim());
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
        <li>Mountain Project &rarr; Profile &rarr; Ticks</li>
        <li>Make your ticks public</li>
        <li>Copy the &ldquo;Export CSV&rdquo; URL and paste it below</li>
      </ol>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.mountainproject.com/user/.../tick-export"
        className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-500/60"
        data-testid="settings-mp-url"
      />

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
      <LeaveGuardSheet guard={leaveGuard} lost="The Mountain Project link you pasted" />
    </section>
  );
}
