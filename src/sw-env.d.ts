// Worker-only ambient types (compiled with the WebWorker lib, not DOM).
// These augment service-worker globals that aren't in TypeScript's lib yet.

interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

interface ServiceWorkerGlobalScopeEventMap {
  periodicsync: PeriodicSyncEvent;
}
