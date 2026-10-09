/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import {
  DB_NAME,
  REMINDER_CONFIG_KEY,
  REMINDER_LAST_FIRED_KEY,
  REMINDER_NOTIFICATION_TAG,
  shouldFireReminder,
  reminderText,
  type ReminderConfig,
} from "./lib/reminderCore";
import { toLocalDateString } from "./lib/dates";

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

// Deep links like /history and /settings are client-side routes with no file
// behind them, so every navigation gets the precached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// ─── Daily reminder (Periodic Background Sync) ────────────────────────────────
//
// Imports only ./lib/reminderCore (pure, DOM-free). We read config + today's
// plan straight from IndexedDB and show the notification via the registration.

const REMINDER_SYNC_TAG = "daily-reminder";
const NOTIFICATION_TAG = REMINDER_NOTIFICATION_TAG; // same tag as foreground → collapses duplicates
const CONFIG_KEY = REMINDER_CONFIG_KEY;
const LAST_FIRED_KEY = REMINDER_LAST_FIRED_KEY;

function openHistoryDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    // Open at the current version — the app creates/upgrades the schema.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      // Never block an app schema upgrade behind this short-lived connection.
      db.onversionchange = () => db.close();
      resolve(db);
    };
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

type SchedulePlan = { dayTypes?: string[] };

async function runDailyReminder(now: Date = new Date()): Promise<void> {
  const db = await openHistoryDB();
  if (!db) return;
  try {
    if (
      !db.objectStoreNames.contains("meta") ||
      !db.objectStoreNames.contains("schedules")
    ) {
      return;
    }

    const config = await idbGet<ReminderConfig>(db, "meta", CONFIG_KEY);
    if (!config?.enabled) return;

    const todayKey = toLocalDateString(now);
    const lastFired = await idbGet<string>(db, "meta", LAST_FIRED_KEY);
    const plan = await idbGetByIndex<SchedulePlan>(db, "schedules", "by-date", todayKey);
    const dayTypes = plan?.dayTypes ?? [];

    if (
      !shouldFireReminder({
        enabled: config.enabled,
        time: config.time,
        lastFired,
        now,
        dayTypes,
      })
    ) {
      return;
    }

    const { title, body } = reminderText(dayTypes);
    await sw.registration.showNotification(title, {
      body,
      tag: NOTIFICATION_TAG,
      icon: "/icons/icon-192.png",
    });

    await idbPut(db, "meta", todayKey, LAST_FIRED_KEY);
  } finally {
    db.close();
  }
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
