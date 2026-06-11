import { getSyncMeta, setSyncMeta, applyServerChanges, initDB, getDirtyApplications, clearDirty } from './db';
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

    // 1. Send dirty applications to server, one at a time
    const dirtyApps = await getDirtyApplications();
    for (const app of dirtyApps) {
      try {
        const response = await fetch(`/api/applications/${app.id}/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(app),
        });
        if (!response.ok) throw new Error('Push failed');
        // Clear dirty bit after successful push
        await clearDirty(app.id);
      } catch (error) {
        console.error(`Failed to push application ${app.id}:`, error);
        throw error;
      }
    }

    // 2. Get sync metadata from server
    const syncResponse = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        last_sync_version: lastSyncVersion,
        changes: [],
        interview_changes: []
      }),
    });

    if (!syncResponse.ok) throw new Error('Sync failed');
    const data: SyncResponse = await syncResponse.json();

    // 3. Apply changes from server
    await applyServerChanges(data.changes, data.interview_changes);
    await setSyncMeta('last_sync_version', data.server_version);

    // 4. Pull dirty applications from server, one at a time
    if (data.dirty_ids && data.dirty_ids.length > 0) {
      for (const appId of data.dirty_ids) {
        try {
          const getResponse = await fetch(`/api/applications/${appId}/get`);
          if (!getResponse.ok) throw new Error('Get application failed');
          const serverApp = await getResponse.json();

          // Merge with local data (server wins)
          const db = await initDB();
          await db.put('applications', serverApp);
        } catch (error) {
          console.error(`Failed to pull application ${appId}:`, error);
        }
      }
    }

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

// Push all applications to server
export async function pushAllApplications() {
  syncState.status = 'syncing';
  notify();

  try {
    const db = await initDB();
    const allApps = await db.getAll('applications');
    const activeApps = allApps.filter(app => !app.is_deleted);

    // Push each application to server
    for (const app of activeApps) {
      try {
        const response = await fetch(`/api/applications/${app.id}/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(app),
        });
        if (!response.ok) throw new Error('Push failed');
        // Clear dirty bit after successful push
        await clearDirty(app.id);
      } catch (error) {
        console.error(`Failed to push application ${app.id}:`, error);
        throw error;
      }
    }

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
    console.error('Push All error:', error);
  } finally {
    notify();
  }
}

// Background sync interval
setInterval(() => {
  if (syncState.status !== 'offline') {
    performSync();
  }
}, 30000); // Every 30 seconds
