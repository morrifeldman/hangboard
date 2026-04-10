export const SPORT_GRADES = [
  "5.10a", "5.10b", "5.10c", "5.10d",
  "5.11a", "5.11b", "5.11c", "5.11d",
  "5.12a", "5.12b", "5.12c", "5.12d",
  "5.13a", "5.13b", "5.13c", "5.13d",
] as const;

export const BOULDER_GRADES = [
  "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15",
] as const;

export type ClimbStyle = "onsight" | "flash" | "redpoint" | "attempt";
export type ClimbType = "sport" | "boulder";
export type ClimbSetting = "outdoor" | "indoor";

export type ViewKey = "outdoor-sport" | "indoor-sport" | "outdoor-boulder" | "indoor-boulder";

export const VIEWS: readonly { key: ViewKey; label: string; type: ClimbType; setting: ClimbSetting }[] = [
  { key: "outdoor-sport",   label: "Outdoor Sport",   type: "sport",   setting: "outdoor" },
  { key: "indoor-sport",    label: "Indoor Sport",    type: "sport",   setting: "indoor" },
  { key: "outdoor-boulder", label: "Outdoor Boulder", type: "boulder", setting: "outdoor" },
  { key: "indoor-boulder",  label: "Indoor Boulder",  type: "boulder", setting: "indoor" },
];

export const STYLE_PRIORITY: Record<ClimbStyle, number> = {
  onsight: 1,
  flash: 2,
  redpoint: 3,
  attempt: 4,
};
