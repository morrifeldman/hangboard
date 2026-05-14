import { VIEWS } from "../../constants/climbGrades";
import type { ViewKey } from "../../constants/climbGrades";
import type { ClimbRecord } from "../../lib/climbs";

type Props = {
  currentView: ViewKey;
  showSendsOnly: boolean;
  setShowSendsOnly: (v: boolean) => void;
  climbs: ClimbRecord[];
};

export function ViewTabs({ currentView, showSendsOnly, setShowSendsOnly, climbs }: Props) {
  const viewConfig = VIEWS.find((v) => v.key === currentView)!;
  const count = climbs.filter((c) => {
    const matchesView = c.type === viewConfig.type && c.setting === viewConfig.setting;
    return matchesView && (showSendsOnly ? c.style !== "attempt" : true);
  }).length;

  return (
    <div className="border-b border-gray-700 flex items-center gap-2 px-4 py-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={showSendsOnly}
          onChange={(e) => setShowSendsOnly(e.target.checked)}
          className="w-4 h-4 text-green-600 border-gray-600 rounded focus:ring-green-500 bg-gray-700"
        />
        Sends Only
      </label>
      <span className="text-xs text-gray-500">{count} climbs</span>
    </div>
  );
}
