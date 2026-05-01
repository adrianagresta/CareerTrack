import { getSyncMeta, setSyncMeta, applyServerChanges, initDB } from './db';
import { JobApplication, SyncRequest, SyncResponse } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'success';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  failedAttempts: number;
}

const MAX_ATTEMPTS = 3;
let syncState: SyncState = {
  status: 'idle',
  lastSyncTime: null,
  failedAttempts: 0,
};

let statusListeners: ((state: SyncState) => void)[] = [];

export function subscribeToSync(callback: (state: SyncState) => void) {
  statusListeners.push(callback);
  callback(syncState);
  return () => {
    statusListeners = statusListeners.filter(l => l !== callback);
  };
}

function notify() {
  statusListeners.forEach(l => l(syncState));
}

export async function performSync() {
  if (syncState.status === 'offline' && syncState.failedAttempts >= MAX_ATTEMPTS) {
    // Don't auto-sync if hard-offline
    return;
  }

  syncState.status = 'syncing';
  notify();

  try {
    const lastSyncVersion = await getSyncMeta('last_sync_version');
    
    // Get all local changes. For this implementation, we send all records 
    // and let the server decide based on updated_at.
    const db = await initDB();
    const allLocal = await db.getAll('applications');
    const allInterviews = await db.getAll('interviews');
    
    const syncRequest: SyncRequest = {
      last_sync_version: lastSyncVersion,
      changes: allLocal,
      interview_changes: allInterviews
    };

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncRequest),
    });

    if (!response.ok) throw new Error('Sync failed');

    const data: SyncResponse = await response.json();

    await applyServerChanges(data.changes, data.interview_changes);
    await setSyncMeta('last_sync_version', data.server_version);

    syncState = {
      status: 'success',
      lastSyncTime: Date.now(),
      failedAttempts: 0,
    };
    
    // After a success, set back to idle after a delay
    setTimeout(() => {
      if (syncState.status === 'success') {
        syncState.status = 'idle';
        notify();
      }
    }, 3000);

  } catch (error) {
    syncState.failedAttempts++;
    if (syncState.failedAttempts >= MAX_ATTEMPTS) {
      syncState.status = 'offline';
    } else {
      syncState.status = 'error';
    }
    console.error('Sync error:', error);
  } finally {
    notify();
  }
}

// Manual sync trigger
export async function manualSync() {
  syncState.failedAttempts = 0; // Reset attempts
  await performSync();
}

// Background sync interval
setInterval(() => {
  if (syncState.status !== 'offline') {
    performSync();
  }
}, 30000); // Every 30 seconds
