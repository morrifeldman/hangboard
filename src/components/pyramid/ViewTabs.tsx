import { disciplineName } from "../../constants/climbGrades";
import type { DisciplineFilter, ViewKey } from "../../constants/climbGrades";
import type { ClimbRecord } from "../../lib/climbs";
import { climbsInView, isLeadSend } from "../../lib/climbUtils";

type Props = {
  currentView: ViewKey;
  discipline: DisciplineFilter;
  showSendsOnly: boolean;
  climbs: ClimbRecord[];
  onShowScrolling: () => void;
};

/** "Outdoor routes", "Outdoor sport", "Outdoor trad" or "Outdoor TR", for the chosen filter. */
function routesLabel(discipline: DisciplineFilter): string {
  return discipline === "all" ? "Outdoor routes" : `Outdoor ${disciplineName(discipline)}`;
}

export function ViewTabs({ currentView, discipline, showSendsOnly, climbs, onShowScrolling }: Props) {
  const inView = climbsInView(climbs, currentView, discipline);
  const count = showSendsOnly ? inView.filter(isLeadSend).length : inView.length;

  return (
    <div className="border-b border-gray-800 px-4 py-1 flex items-center justify-between">
      <span className="text-sm text-gray-400" data-testid="pyramid-count">
        {routesLabel(discipline)} · <span className="font-num text-gray-200">{count}</span>{" "}
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
