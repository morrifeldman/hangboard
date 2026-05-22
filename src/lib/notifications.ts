import { getSchedule, SCHEDULE_TYPE_META, toLocalDateString } from "./schedules";

export type NotificationPrefs = {
  enabled: boolean;
  time: string; // "HH:MM"
  lastFiredDate: string | null; // YYYY-MM-DD
};

const STORAGE_KEY = "cairn-notification-prefs";
const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  time: "07:00",
  lastFiredDate: null,
};

function isPrefs(v: unknown): v is NotificationPrefs {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.enabled === "boolean" &&
    typeof o.time === "string" &&
    (o.lastFiredDate === null || typeof o.lastFiredDate === "string")
  );
}

export function getPrefs(): NotificationPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    if (isPrefs(parsed)) return parsed;
  } catch {
    // fall through
  }
  return { ...DEFAULT_PREFS };
}

export function setPrefs(patch: Partial<NotificationPrefs>): NotificationPrefs {
  const next = { ...getPrefs(), ...patch };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function permissionStatus(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

// ─── Pure ────────────────────────────────────────────────────────────────────

/** "HH:MM" → minutes since midnight. Invalid input returns NaN. */
export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return NaN;
  return h * 60 + mm;
}

export function shouldFireToday(
  prefs: NotificationPrefs,
  now: Date,
  hasPlanToday: boolean,
): boolean {
  if (!prefs.enabled) return false;
  if (!hasPlanToday) return false;
  const today = toLocalDateString(now);
  if (prefs.lastFiredDate === today) return false;
  const target = parseHHMM(prefs.time);
  if (Number.isNaN(target)) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= target;
}

// ─── Side-effect entry point ──────────────────────────────────────────────────

export async function maybeFireDailyReminder(now: Date = new Date()): Promise<void> {
  const prefs = getPrefs();
  if (!prefs.enabled) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const todayKey = toLocalDateString(now);
  if (prefs.lastFiredDate === todayKey) return;
  const target = parseHHMM(prefs.time);
  if (Number.isNaN(target)) return;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < target) return;

  const plan = await getSchedule(todayKey);
  if (!plan?.dayType) return;

  const meta = SCHEDULE_TYPE_META[plan.dayType];
  try {
    new Notification(`Today: ${meta.label} day`, {
      body: "Open Cairn to plan, log, or jump in.",
      tag: "cairn-daily",
      icon: "/icons/icon-192.png",
    });
  } catch {
    // Some browsers throw if the page is not in a permitted context
    return;
  }
  setPrefs({ lastFiredDate: todayKey });
}
