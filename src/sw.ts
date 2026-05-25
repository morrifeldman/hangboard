/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

// `self` is typed as WorkerGlobalScope by the WebWorker lib; alias to the
// service-worker scope for the SW-specific APIs without redeclaring.
const sw = self as unknown as ServiceWorkerGlobalScope;

// Match the previous generateSW autoUpdate behavior: take control immediately.
sw.skipWaiting();
clientsClaim();
// NOTE: reference `self.__WB_MANIFEST` verbatim — workbox-build's injectManifest
// string-replaces this exact expression with the precache list. Aliasing `self`
// here would erase the marker and break the build.
precacheAndRoute(
  (self as unknown as { __WB_MANIFEST: Array<{ url: string; revision: string | null }> })
    .__WB_MANIFEST,
);

// ─── Daily reminder (Periodic Background Sync) ────────────────────────────────
//
// Self-contained on purpose: the SW must not import DOM-dependent app modules
// (localStorage, Notification, etc. don't exist here). We read config + today's
// plan straight from IndexedDB and show the notification via the registration.

const DB_NAME = "hangboard-history";
const REMINDER_SYNC_TAG = "daily-reminder";
const NOTIFICATION_TAG = "cairn-daily"; // same tag as foreground → collapses duplicates
const CONFIG_KEY = "reminder-config";
const LAST_FIRED_KEY = "reminder-last-fired";

const TYPE_LABELS: Record<string, string> = {
  power: "Power",
  endurance: "Endurance",
  hangboard: "Hangboard",
  outdoor: "Outdoor",
  bouldering: "Bouldering",
  stretching: "Stretching",
  rest: "Rest",
};

type ReminderConfig = { enabled: boolean; time: string };

function openHistoryDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    // Open at the current version — the app creates/upgrades the schema.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbGetByIndex<T>(
  db: IDBDatabase,
  store: string,
  index: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).index(index).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPut(db: IDBDatabase, store: string, value: unknown, key: IDBValidKey): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return NaN;
  return h * 60 + mm;
}

type SchedulePlan = { dayTypes?: string[] };

async function runDailyReminder(now: Date = new Date()): Promise<void> {
  const db = await openHistoryDB();
  if (!db) return;
  if (
    !db.objectStoreNames.contains("meta") ||
    !db.objectStoreNames.contains("schedules")
  ) {
    db.close();
    return;
  }

  const config = await idbGet<ReminderConfig>(db, "meta", CONFIG_KEY);
  if (!config?.enabled) return db.close();

  const todayKey = toLocalDateString(now);
  const lastFired = await idbGet<string>(db, "meta", LAST_FIRED_KEY);
  if (lastFired === todayKey) return db.close();

  const target = parseHHMM(config.time);
  if (Number.isNaN(target)) return db.close();
  if (now.getHours() * 60 + now.getMinutes() < target) return db.close();

  const plan = await idbGetByIndex<SchedulePlan>(db, "schedules", "by-date", todayKey);
  const dayTypes = plan?.dayTypes ?? [];
  if (dayTypes.length === 0) return db.close();

  const labels = dayTypes.map((t) => TYPE_LABELS[t] ?? t).join(" + ");
  await sw.registration.showNotification(`Today: ${labels} day`, {
    body: "Open Cairn to plan, log, or jump in.",
    tag: NOTIFICATION_TAG,
    icon: "/icons/icon-192.png",
  });

  await idbPut(db, "meta", todayKey, LAST_FIRED_KEY);
  db.close();
}

sw.addEventListener("periodicsync", (event) => {
  if (event.tag === REMINDER_SYNC_TAG) {
    event.waitUntil(runDailyReminder());
  }
});

// On-demand test from the Settings screen — fires a notification immediately so
// the user can confirm delivery works (e.g. on their phone) without waiting.
sw.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "test-reminder") {
    event.waitUntil(
      sw.registration.showNotification("Cairn test reminder", {
        body: "Background notifications are working.",
        tag: NOTIFICATION_TAG,
        icon: "/icons/icon-192.png",
      }),
    );
  }
});

// Focus an existing window (or open one) when the reminder is tapped.
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (sw.clients.openWindow) await sw.clients.openWindow("/");
    })(),
  );
});
