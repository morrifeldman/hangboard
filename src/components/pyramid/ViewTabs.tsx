import { VIEWS } from "../../constants/climbGrades";
import type { ViewKey } from "../../constants/climbGrades";
import type { ClimbRecord } from "../../lib/climbs";

type Props = {
  currentView: ViewKey;
  showSendsOnly: boolean;
  climbs: ClimbRecord[];
};

export function ViewTabs({ currentView, showSendsOnly, climbs }: Props) {
  const viewConfig = VIEWS.find((v) => v.key === currentView)!;
  const count = climbs.filter((c) => {
    const matchesView = c.type === viewConfig.type && c.setting === viewConfig.setting;
    return matchesView && (showSendsOnly ? c.style !== "attempt" : true);
  }).length;

  return (
    <div className="border-b border-gray-700 px-4 py-2">
      <span className="text-xs text-gray-500 tabular-nums">
        {count} {showSendsOnly ? "send" : "climb"}{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}
