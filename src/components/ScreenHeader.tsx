import type { ReactNode } from "react";
import { BackChevronIcon } from "./icons";

/** The header for drill-in screens: back chevron, title, optional actions on the right. */
export function ScreenHeader({ title, onBack, actions }: { title: ReactNode; onBack: () => void; actions?: ReactNode }) {
  return (
    <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3 shrink-0">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white transition-colors p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded"
        aria-label="Back"
      >
        <BackChevronIcon />
      </button>
      <h1 className="flex-1 min-w-0 truncate text-white font-bold text-lg">{title}</h1>
      {actions}
    </header>
  );
}
