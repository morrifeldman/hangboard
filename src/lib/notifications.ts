import {
  getSchedule,
  normalizeDayTypes,
  SCHEDULE_TYPE_META,
  toLocalDateString,
} from "./schedules";
import { setMeta } from "./history";

/**
 * Key in the shared IDB `meta` store holding `{ enabled, time }`. The service
 * worker reads this to decide whether to fire a background reminder, since it
 * has no access to `localStorage`. The app mirrors prefs here on every change.
 */
export const REMINDER_CONFIG_KEY = "reminder-config";
/** Tag used for the daily Periodic Background Sync registration. */
export const REMINDER_SYNC_TAG = "daily-reminder";

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
  // Mirror the enable/time settings into IDB so the service worker can read them.
  void setMeta(REMINDER_CONFIG_KEY, { enabled: next.enabled, time: next.time }).catch(
    () => {},
  );
  return next;
}

// ─── Periodic Background Sync (background reminders) ───────────────────────────

/**
 * Register the daily background reminder via the Periodic Background Sync API.
 * Client-only — no server. Chrome on installed Android PWAs fires the
 * `periodicsync` event opportunistically (roughly daily, gated on engagement),
 * so delivery timing is approximate, not a precise alarm. No-op where the API
 * or permission is unavailable.
 */
export async function registerPeriodicReminder(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.periodicSync) return;
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (status.state !== "granted") return;
    await reg.periodicSync.register(REMINDER_SYNC_TAG, {
      minInterval: 12 * 60 * 60 * 1000, // 12h floor; browser decides actual cadence
    });
  } catch {
    // Unsupported / permission unavailable — foreground reminder still works.
  }
}

export async function unregisterPeriodicReminder(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync?.unregister(REMINDER_SYNC_TAG);
  } catch {
    // ignore
  }
}

export type PeriodicReminderSupport =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

/** Whether background (closed-app) reminders are available on this device. */
export async function periodicReminderStatus(): Promise<PeriodicReminderSupport> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.periodicSync) return "unsupported";
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    return status.state as PeriodicReminderSupport;
  } catch {
    return "unsupported";
  }
}

/**
 * Called on app startup: mirror current prefs into IDB and (re)register the
 * background sync if reminders are enabled. Keeps the SW's view of config fresh
 * and re-establishes the registration after a SW update.
 */
export async function ensureReminderRegistered(): Promise<void> {
  const prefs = getPrefs();
  await setMeta(REMINDER_CONFIG_KEY, { enabled: prefs.enabled, time: prefs.time }).catch(
    () => {},
  );
  if (prefs.enabled) await registerPeriodicReminder();
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

/**
 * Fire a notification right now so the user can confirm delivery works. Prefers
 * the service worker (matches the real background path); falls back to a
 * foreground notification when no SW controls the page.
 */
export async function sendTestNotification(): Promise<boolean> {
  if (permissionStatus() !== "granted") return false;
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg?.active) {
      reg.active.postMessage({ type: "test-reminder" });
      return true;
    }
  }
  try {
    new Notification("Cairn test reminder", {
      body: "Notifications are working.",
      tag: "cairn-daily",
    });
    return true;
  } catch {
    return false;
  }
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
  const dayTypes = normalizeDayTypes(plan);
  if (dayTypes.length === 0) return;

  const labels = dayTypes.map((t) => SCHEDULE_TYPE_META[t].label).join(" + ");
  try {
    new Notification(`Today: ${labels} day`, {
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
