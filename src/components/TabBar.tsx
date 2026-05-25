import { BarChartIcon, CalendarIcon, DumbbellIcon, ClockIcon } from "./icons";

export type Tab = "home" | "schedule" | "workout" | "history";

const TABS: { id: Tab; label: string; Icon: typeof BarChartIcon }[] = [
  { id: "home", label: "Progress", Icon: BarChartIcon },
  { id: "schedule", label: "Schedule", Icon: CalendarIcon },
  { id: "workout", label: "Workout", Icon: DumbbellIcon },
  { id: "history", label: "History", Icon: ClockIcon },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="shrink-0 bg-gray-800 border-t border-gray-700 flex pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            data-testid={`tab-${id}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
              isActive ? "text-green-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={22} />
            <span className="text-[0.65rem] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
