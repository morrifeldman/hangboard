import type { ReactNode } from "react";

// Shared controls. "Selected" is always bg-accent-500 with dark text — the one
// accent means "tap here / selected / you are here" (see CLAUDE.md).

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

/** A horizontally scrolling row of pills, with the scrollbar hidden. */
export function PillRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </div>
  );
}

/** A selectable pill. `size="sm"` for dense rows (e.g. hold pickers). */
export function Pill({
  selected,
  onClick,
  children,
  size = "md",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`shrink-0 rounded-full font-medium whitespace-nowrap transition-colors ${FOCUS} ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${selected ? "bg-accent-500 text-gray-900" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
    >
      {children}
    </button>
  );
}

/** A row of mutually exclusive options in one recessed well. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg bg-gray-900/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 min-h-[38px] rounded-md text-sm font-semibold transition-colors ${FOCUS} ${
            value === o.value ? "bg-accent-500 text-gray-900" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** An icon button that holds an on/off state (view toggles in a header). */
export function IconToggle({
  on,
  onToggle,
  label,
  title,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={label}
      title={title}
      className={`px-2.5 py-2 rounded-lg flex items-center text-sm transition-colors ${FOCUS} ${
        on ? "bg-accent-500 text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-700/50"
      }`}
    >
      {children}
    </button>
  );
}
