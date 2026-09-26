export function WarmupBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300 ${className}`}
      data-testid="warmup-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-300" aria-hidden="true" />
      Warm-up
    </span>
  );
}

export function SectionLabel({ children, warmup = false, detail }: {
  children: string;
  warmup?: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pt-2">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wider ${warmup ? "text-teal-300" : "text-gray-400"}`}
      >
        {children}
      </span>
      {detail && <span className="text-[11px] text-gray-500">{detail}</span>}
    </div>
  );
}
