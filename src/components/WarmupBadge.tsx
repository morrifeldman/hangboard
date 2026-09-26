import { useWorkoutStore } from "../store/useWorkoutStore";
import { isWarmup } from "../data/holds";
import type { HoldDefinition } from "../data/holds";

/** "Warm-up 4 of 8" for the hold in progress; a lone warm-up hold drops the count. */
export function WarmupBadge({ hold, className = "" }: { hold?: HoldDefinition; className?: string }) {
  const currentHolds = useWorkoutStore((s) => s.currentHolds);
  const warmups = currentHolds().filter(isWarmup);
  const step = hold ? warmups.findIndex((h) => h.id === hold.id) + 1 : 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-teal-400/10 px-3 py-1 text-sm font-semibold text-teal-200 ${className}`}
      data-testid="warmup-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-300" aria-hidden="true" />
      Warm-up
      {step > 0 && warmups.length > 1 && (
        <span className="font-normal tabular-nums text-teal-200/70">{step} of {warmups.length}</span>
      )}
    </span>
  );
}

export function SectionLabel({ children, detail }: { children: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pt-3">
      <h3 className="text-sm font-semibold text-gray-300">{children}</h3>
      {detail && <span className="text-xs text-gray-500">{detail}</span>}
    </div>
  );
}
