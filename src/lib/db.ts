import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME } from "./reminderCore";

// One IndexedDB database for everything the app records. The service worker
// opens it too (raw API, see sw.ts), so the name lives in reminderCore.

const DB_VERSION = 5;
/** Device-local key/value store (reminder config etc.) shared with the service worker. */
const META_STORE = "meta";

/** The record stores. Each record has a string `id` keyPath. */
export type RecordStoreName = "sessions" | "climbs" | "notes" | "schedules";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // A newer tab/SW wants to upgrade: release our connection so it isn't
      // blocked forever, and reopen lazily on next use.
      blocking() {
        void dbPromise?.then((db) => db.close()).catch(() => {});
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
      // Each store is created if missing, so any older version upgrades in one
      // pass. A future migration that transforms data should switch on
      // `oldVersion` here.
      upgrade(db) {
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("by-start", "startedAt");
        }
        if (!db.objectStoreNames.contains("climbs")) {
          const climbStore = db.createObjectStore("climbs", { keyPath: "id" });
          climbStore.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("notes")) {
          const noteStore = db.createObjectStore("notes", { keyPath: "id" });
          noteStore.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("schedules")) {
          const schedStore = db.createObjectStore("schedules", { keyPath: "id" });
          schedStore.createIndex("by-date", "date", { unique: true });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          // Out-of-line keys: db.put(META_STORE, value, key)
          db.createObjectStore(META_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Read a device-local key/value entry from the shared `meta` store. */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get(META_STORE, key)) as T | undefined;
}

/** Write a device-local key/value entry to the shared `meta` store. */
export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put(META_STORE, value, key);
}

/** The CRUD every record store shares. Domain modules wrap it with their own names. */
export function recordStore<T extends { id: string }>(name: RecordStoreName) {
  return {
    async put(record: T): Promise<void> {
      await (await getDB()).put(name, record);
    },
    async get(id: string): Promise<T | undefined> {
      return (await (await getDB()).get(name, id)) as T | undefined;
    },
    async remove(id: string): Promise<void> {
      await (await getDB()).delete(name, id);
    },
    async all(): Promise<T[]> {
      return (await (await getDB()).getAll(name)) as T[];
    },
    /** All records in ascending index order. */
    async allBy(index: string): Promise<T[]> {
      return (await (await getDB()).getAllFromIndex(name, index)) as T[];
    },
  };
}

/**
 * Replace the full contents of one or more stores in a single transaction:
 * either every store ends up with exactly the given records, or (on any error,
 * e.g. a duplicate schedule date) nothing changes.
 */
export async function replaceStores(
  data: Partial<Record<RecordStoreName, readonly { id: string }[]>>,
): Promise<void> {
  const names = Object.keys(data) as RecordStoreName[];
  if (names.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(names, "readwrite");
  // Queue every request synchronously, then wait once: awaiting between
  // requests is what lets a transaction auto-commit halfway.
  const ops: Promise<unknown>[] = [];
  for (const name of names) {
    const store = tx.objectStore(name);
    ops.push(store.clear());
    for (const r of data[name] ?? []) ops.push(store.put(r));
  }
  try {
    await Promise.all([...ops, tx.done]);
  } catch (err) {
    // Settle the rest so a failed restore reports one error, not many.
    await Promise.allSettled([...ops, tx.done]);
    throw err;
  }
}
