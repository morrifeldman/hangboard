import { VIEWS } from "../../constants/climbGrades";
import type { ViewKey } from "../../constants/climbGrades";
import type { ClimbRecord } from "../../lib/climbs";

type Props = {
  currentView: ViewKey;
  showSendsOnly: boolean;
  climbs: ClimbRecord[];
  onShowScrolling: () => void;
};

export function ViewTabs({ currentView, showSendsOnly, climbs, onShowScrolling }: Props) {
  const viewConfig = VIEWS.find((v) => v.key === currentView)!;
  const count = climbs.filter((c) => {
    const matchesView = c.type === viewConfig.type && c.setting === viewConfig.setting;
    return matchesView && (showSendsOnly ? c.style !== "attempt" : true);
  }).length;

  return (
    <div className="border-b border-gray-800 px-4 py-1 flex items-center justify-between">
      <span className="text-sm text-gray-400">
        Outdoor sport · <span className="font-num text-gray-200">{count}</span>{" "}
        {showSendsOnly ? "send" : "climb"}{count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        onClick={onShowScrolling}
        className="-mr-2 px-2 py-2.5 rounded-lg text-sm font-semibold text-accent-400 hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        Pyramids over time
      </button>
    </div>
  );
}
