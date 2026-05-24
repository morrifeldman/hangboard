// Periodic Background Sync API — not yet in TypeScript's standard lib.
// Augments ServiceWorkerRegistration (present in both DOM and WebWorker libs).
export {};

declare global {
  interface PeriodicSyncManager {
    register(tag: string, options?: { minInterval: number }): Promise<void>;
    unregister(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }

  interface ServiceWorkerRegistration {
    readonly periodicSync?: PeriodicSyncManager;
  }
}
