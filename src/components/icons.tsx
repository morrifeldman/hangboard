type IconProps = {
  size?: number;
  className?: string;
  "aria-label"?: string;
};

const SVG_DEFAULTS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Svg({ size = 24, className, label, children }: {
  size?: number;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      {...SVG_DEFAULTS}
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export function BackChevronIcon({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function PyramidIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </Svg>
  );
}

export function BarChartIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}

export function ClockIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

export function CalendarIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

export function DumbbellIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </Svg>
  );
}

export function NoteIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </Svg>
  );
}

export function GearIcon({ size = 24, className, "aria-label": label }: IconProps) {
  return (
    <Svg size={size} className={className} label={label}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}
