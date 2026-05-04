/**
 * Legacy sync service - maintained for backward compatibility
 * Delegates to the new SyncManager
 */

import { getSyncManager, performSync as managerPerformSync, subscribeToSync as managerSubscribeToSync, manualSync as managerManualSync } from './syncManager';

export { SyncStatus, SyncState } from './syncManager';

// Export legacy API functions that delegate to SyncManager
export function performSync() {
  return managerPerformSync();
}

export function subscribeToSync(callback: (state: any) => void): () => void {
  return managerSubscribeToSync(callback);
}

export function manualSync() {
  return managerManualSync();
}

// Legacy setInterval for backward compatibility (the sync manager handles this internally now)
// This is kept for any code that imports from this file but doesn't use the functions
if (typeof globalThis !== 'undefined' && !globalThis.syncServiceInitialized) {
  // Mark that we've set this up
  (globalThis as any).syncServiceInitialized = true;
  // SyncManager handles its own interval, so no need to set up another one
}
}

// Background sync interval
setInterval(() => {
  if (syncState.status !== 'offline') {
    performSync();
  }
}, 30000); // Every 30 seconds
