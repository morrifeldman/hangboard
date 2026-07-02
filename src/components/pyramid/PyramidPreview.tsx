import { buildPyramid, getFilteredClimbs, getStyleColor } from "../../lib/climbUtils";
import { deduplicateForPyramid } from "../../lib/deduplication";
import type { ClimbRecord } from "../../lib/climbs";
import { PyramidIcon } from "../icons";

// Compact, read-only outdoor-sport pyramid rendered on the home screen. Mirrors
// the default view of the full PyramidScreen (outdoor sport, sends only, full
// time range) but strips all interactivity — tapping anywhere opens the full
// pyramid page with the real controls.
const TILE = 12;
const GAP = 3;

type Props = {
  climbs: ClimbRecord[];
  onOpen: () => void;
};

export function PyramidPreview({ climbs, onOpen }: Props) {
  const filtered = getFilteredClimbs(climbs, "outdoor-sport", false, [0, 100]);
  const deduped = deduplicateForPyramid(filtered);
  const sends = deduped.filter((c) => c.style !== "attempt");
  // Only non-empty grade rows keep the preview short; the widening toward the
  // base still reads as a pyramid.
  const rows = buildPyramid(sends, "outdoor-sport").filter((r) => r.climbs.length > 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="open-pyramid"
      className="w-full bg-gray-800 rounded-xl px-4 py-3 text-left transition-colors hover:bg-gray-700/60 active:bg-gray-700 focus:outline-none"
    >
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-gray-500 text-sm">
          <PyramidIcon size={16} />
          No outdoor sport sends yet — tap to add
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.grade} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-right text-[11px] font-medium tabular-nums text-gray-400">
                  {r.grade}
                </span>
                <div className="flex flex-1 justify-center">
                  <div className="flex flex-wrap justify-center" style={{ gap: GAP }}>
                    {r.climbs.map((c, i) => (
                      <div
                        key={i}
                        className={getStyleColor(c.style)}
                        style={{ width: TILE, height: TILE, borderRadius: 2 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-xs font-semibold text-teal-300">
            <PyramidIcon size={13} />
            Tap to open full pyramid →
          </div>
        </>
      )}
    </button>
  );
}
