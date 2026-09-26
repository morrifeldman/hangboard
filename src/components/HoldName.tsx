import type { HTMLAttributes } from "react";

/**
 * Warm-up holds are named "Big Edge — Half Crimp". Left to wrap on its own, that
 * breaks after the dash or mid-grip, so the edge gets its own small line above
 * the grip, which is the part you actually change between holds.
 */
export function HoldName({
  name,
  suffix,
  edgeClassName = "text-gray-400 text-sm font-medium",
  ...rest
}: { name: string; suffix?: string; edgeClassName?: string } & HTMLAttributes<HTMLParagraphElement>) {
  const [edge, grip] = name.includes(" — ") ? name.split(" — ", 2) : [null, name];
  return (
    <div>
      {edge && <p className={edgeClassName}>{edge}</p>}
      <p {...rest}>
        {grip}
        {suffix && <span className="whitespace-nowrap"> {suffix}</span>}
      </p>
    </div>
  );
}
