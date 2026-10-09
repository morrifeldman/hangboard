/**
 * Daily-reminder logic shared by the app (notifications.ts) and the service
 * worker (sw.ts). Must stay dependency-free: no DOM globals, no idb, no app
 * modules that touch localStorage/Notification. (./dates is DOM-free too.)
 */

import { toLocalDateString } from "./dates";

export const DB_NAME = "hangboard-history";
/** `meta` key holding `{ enabled, time }` — written by the app, read by the SW. */
export const REMINDER_CONFIG_KEY = "reminder-config";
/** `meta` key holding the YYYY-MM-DD the reminder last fired. Single source of truth. */
export const REMINDER_LAST_FIRED_KEY = "reminder-last-fired";
/** Notification tag shared by foreground + background paths (collapses duplicates). */
export const REMINDER_NOTIFICATION_TAG = "cairn-daily";

export type ReminderConfig = { enabled: boolean; time: string };

/** Must match SCHEDULE_TYPE_META labels (enforced by a unit test). */
export const DAY_TYPE_LABELS: Record<string, string> = {
  power: "Power",
  endurance: "Endurance",
  hangboard: "Hangboard",
  outdoor: "Outdoor",
  stretching: "Stretching",
  cardio: "Cardio",
  rest: "Rest",
};

/** "HH:MM" → minutes since midnight. Invalid input returns NaN. */
export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return NaN;
  return h * 60 + mm;
}

export function shouldFireReminder(args: {
  enabled: boolean;
  time: string;
  lastFired: string | null | undefined;
  now: Date;
  dayTypes: readonly string[];
}): boolean {
  const { enabled, time, lastFired, now, dayTypes } = args;
  if (!enabled) return false;
  if (dayTypes.length === 0) return false;
  if (lastFired === toLocalDateString(now)) return false;
  const target = parseHHMM(time);
  if (Number.isNaN(target)) return false;
  return now.getHours() * 60 + now.getMinutes() >= target;
}

export function reminderText(dayTypes: readonly string[]): { title: string; body: string } {
  const labels = dayTypes.map((t) => DAY_TYPE_LABELS[t] ?? t).join(" + ");
  return {
    title: `Today: ${labels} day`,
    body: "Open Cairn to plan, log, or jump in.",
  };
}
