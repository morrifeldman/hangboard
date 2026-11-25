import type { DisciplineFilter } from "../../constants/climbGrades";

const NEXT: Record<DisciplineFilter, DisciplineFilter> = { all: "sport", sport: "trad", trad: "all" };
const LABEL: Record<DisciplineFilter, string> = { all: "All", sport: "Sport", trad: "Trad" };
const CAPTION: Record<DisciplineFilter, string> = {
  all: "Sport and trad · trad is round",
  sport: "Sport only",
  trad: "Trad only",
};

/**
 * The route views' All / Sport / Trad choice, as one header button that cycles
 * through them. It sits in the toggle well next to Sends only, lit while it
 * narrows the routes. `onCaption` gets the toggle-caption text for the new value.
 */
export function DisciplineToggle({
  value,
  onChange,
  onCaption,
}: {
  value: DisciplineFilter;
  onChange: (d: DisciplineFilter) => void;
  onCaption: (text: string) => void;
}) {
  const next = NEXT[value];
  const on = value !== "all";
  return (
    <button
      type="button"
      onClick={() => {
        onCaption(CAPTION[next]);
        onChange(next);
      }}
      aria-label={`Route type: ${LABEL[value]}`}
      title={`${LABEL[value]} routes — tap for ${LABEL[next].toLowerCase()}`}
      data-testid="discipline-toggle"
      className={`w-[3.25rem] py-2 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
        on ? "bg-accent-500 text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-700/50"
      }`}
    >
      {LABEL[value]}
    </button>
  );
}
