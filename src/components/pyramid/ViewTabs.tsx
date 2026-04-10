import { Mountain, Home } from "lucide-react";
import { VIEWS } from "../../constants/climbGrades";
import type { ViewKey } from "../../constants/climbGrades";
import type { ClimbRecord } from "../../lib/climbs";

type Props = {
  currentView: ViewKey;
  setCurrentView: (v: ViewKey) => void;
  showSendsOnly: boolean;
  setShowSendsOnly: (v: boolean) => void;
  climbs: ClimbRecord[];
};

export function ViewTabs({ currentView, setCurrentView, showSendsOnly, setShowSendsOnly, climbs }: Props) {
  const viewConfig = VIEWS.find((v) => v.key === currentView)!;
  const count = climbs.filter((c) => {
    const matchesView = c.type === viewConfig.type && c.setting === viewConfig.setting;
    return matchesView && (showSendsOnly ? c.style !== "attempt" : true);
  }).length;

  return (
    <div className="border-b border-gray-700">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VIEWS.map((view) => {
            const Icon = view.setting === "outdoor" ? Mountain : Home;
            return (
              <button
                key={view.key}
                onClick={() => setCurrentView(view.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 whitespace-nowrap text-sm transition-colors ${
                  currentView === view.key
                    ? "border-green-500 text-green-400 bg-green-500/10"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {view.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-2">
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
      </div>
    </div>
  );
}
