import type { GymData, SessionRecord } from "./history";
import { workoutTypeLabel } from "./historyFilter";
import { formatLiftSets } from "./lifts";
import { liftNextDirection, type WeightDirection } from "./weightCues";

/**
 * A run of text within one summary part. `fig` marks the figure that is the
 * content (History renders it in the numeric face); `arrow` asks the renderer
 * to draw a next-weight cue after the text.
 */
export type SummarySegment = { text: string; fig?: boolean; arrow?: WeightDirection | null };
/** One dot-separated piece of a summary line. */
export type SummaryPart = SummarySegment[];

export const sessionLabel = (s: Pick<SessionRecord, "workoutType">): string =>
  workoutTypeLabel(s.workoutType);

const t = (text: string): SummarySegment => ({ text });
const f = (text: string | number): SummarySegment => ({ text: String(text), fig: true });
const EMPTY: SummaryPart[] = [[t("—")]];

/** Dot-separated pieces describing a gym log. */
export function gymSummaryParts(data: GymData): SummaryPart[] {
  switch (data.type) {
    case "arc": {
      const parts: SummaryPart[] = [[f(data.climbMin), t(" min")]];
      if (data.routes) parts.push([f(data.routes), t(" routes")]);
      if (data.downclimb === "Yes") parts.push([t("downclimb")]);
      else if (data.downclimb === "Some") parts.push([t("some downclimb")]);
      if (data.maxGrade) parts.push([t("Max "), f(data.maxGrade)]);
      return parts;
    }
    case "cir": {
      const parts: SummaryPart[] = [[f(data.repeats), t(" repeats")]];
      if (data.climbRating) parts.push([t(data.climbRating)]);
      parts.push([t("~"), f(`${data.avgRestSec}s`), t(" rest")]);
      return parts;
    }
    case "pe-route":
      return [
        [f(`${data.climbSec}s`), t(" on")],
        [f(data.dutyCycle), t(" rest")],
        [f(data.reps), t(" reps")],
      ];
    case "lbc":
      return [
        [f(data.sets), t(" sets")],
        [f(`${data.climbSec}s`), t(" on")],
        [f(data.dutyCycle), t(" rest")],
      ];
    case "performance":
      return [
        [f(data.grade)],
        [f(data.tries), t(" tries")],
        [t(data.success === "Yes" ? "sent" : "no send")],
      ];
    case "wbl":
      return [[t("Top "), f(data.topV)], [f(data.durationMin), t(" min")]];
    case "hard-bouldering":
    case "limit-bouldering":
      return [[t(data.level)], [f(data.durationMin), t(" min")]];
    case "campus": {
      const n = data.sets.length;
      return [[f(n), t(` set${n === 1 ? "" : "s"}`)]];
    }
    case "injury": {
      const parts = [data.bodyPart, data.severity].filter((x): x is string => !!x);
      return parts.length ? parts.map((p) => [t(p)]) : EMPTY;
    }
    case "stretching": {
      const parts: SummaryPart[] = [];
      if (data.reps && data.holdSec) parts.push([f(data.reps), t(" × "), f(`${data.holdSec}s`)]);
      else if (data.reps) parts.push([f(data.reps), t(" reps")]);
      else if (data.holdSec) parts.push([f(`${data.holdSec}s`), t(" hold")]);
      if (data.stretches && data.stretches.length > 0) parts.push([t(data.stretches.join(", "))]);
      return parts.length ? parts : EMPTY;
    }
    case "cardio": {
      const parts: SummaryPart[] = [[t(data.mode)], [f(data.durationMin), t(" min")]];
      if (data.intensity) parts.push([t(data.intensity)]);
      return parts;
    }
    case "lifts":
      if (data.lifts.length === 0) return EMPTY;
      return data.lifts.map((l) => {
        const sets = formatLiftSets(l);
        return [t(`${l.name} `), sets ? f(sets) : t("skipped"), { text: "", arrow: liftNextDirection(l) }];
      });
    case "freeform": {
      const count = data.sections.reduce((n, s) => n + s.entries.length, 0);
      if (count === 0) return [[t(data.title || "—")]];
      return [[t(data.title)], [f(count), t(count === 1 ? " entry" : " entries")]];
    }
  }
}

/** Summary parts for a session, or null when it has no gym data. */
export function sessionSummary(s: Pick<SessionRecord, "gymData">): SummaryPart[] | null {
  return s.gymData ? gymSummaryParts(s.gymData) : null;
}

/** Plain-text rendering of summary parts. */
export function summaryText(parts: SummaryPart[]): string {
  return parts.map((p) => p.map((seg) => seg.text).join("")).join(" · ");
}
