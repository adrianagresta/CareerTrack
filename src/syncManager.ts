/**
 * Refactored sync service using class-based encapsulation
 */

import { initDB } from './db';
import { SyncMetadataRepository } from './repositories';
import { JobApplication } from './types';
import { SyncRequest, SyncResponse } from './types';
import { getEventBus, SyncStateChangedEvent } from './eventBus';
import { SyncError, logError } from './errors';
import { config } from './config';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'success';

export interface SyncState {
    status: SyncStatus;
    lastSyncTime: number | null;
    failedAttempts: number;
}

/**
 * Encapsulated sync manager for handling server synchronization
 */
export class SyncManager {
    private syncState: SyncState = {
        status: 'idle',
        lastSyncTime: null,
        failedAttempts: 0,
    };

    private statusListeners: Set<(state: SyncState) => void> = new Set();
    private eventBus = getEventBus();
    private syncInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.startAutoSync();
    }

    /**
     * Subscribe to sync state changes
     */
    subscribeToSync(callback: (state: SyncState) => void): () => void {
        this.statusListeners.add(callback);
        // Immediately call with current state
        callback(this.syncState);

        // Return unsubscribe function
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState {
        return { ...this.syncState };
    }

    /**
     * Notify all listeners of state change
     */
    private notify(): void {
        const state = { ...this.syncState };
        this.statusListeners.forEach(listener => {
            try {
                listener(state);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });

        // Also emit to event bus
        this.eventBus.emit<SyncStateChangedEvent>({
            type: 'sync:stateChanged',
            timestamp: Date.now(),
            status: this.syncState.status,
            lastSyncTime: this.syncState.lastSyncTime,
            failedAttempts: this.syncState.failedAttempts,
        });
    }

    /**
     * Perform synchronization with server
     */
    async performSync(): Promise<void> {
        // Don't sync if hard offline
        if (this.syncState.status === 'offline' && this.syncState.failedAttempts >= config.MAX_SYNC_ATTEMPTS) {
            return;
        }

        this.syncState.status = 'syncing';
        this.notify();

        try {
            const db = await initDB();
            const metadataRepo = new SyncMetadataRepository(db);
            const lastSyncVersion = await metadataRepo.get('last_sync_version');

            // Get all local changes
            const allLocal = await db.getAll('applications');
            const allInterviews = await db.getAll('interviews');

            const syncRequest: SyncRequest = {
                last_sync_version: lastSyncVersion,
                changes: allLocal,
                interview_changes: allInterviews,
            };

            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncRequest),
            });

            if (!response.ok) {
                throw new SyncError('Server sync failed with status ' + response.status);
            }

            const data: SyncResponse = await response.json();

            // Apply server changes
            await this.applyServerChanges(db, data.changes, data.interview_changes);
            await metadataRepo.set('last_sync_version', data.server_version);

            this.syncState = {
                status: 'success',
                lastSyncTime: Date.now(),
                failedAttempts: 0,
            };
            this.notify();

            // Revert to idle after display time
            setTimeout(() => {
                if (this.syncState.status === 'success') {
                    this.syncState.status = 'idle';
                    this.notify();
                }
            }, config.SYNC_SUCCESS_DISPLAY_MS);
        } catch (error) {
            logError(error);
            this.syncState.failedAttempts++;

            if (this.syncState.failedAttempts >= config.MAX_SYNC_ATTEMPTS) {
                this.syncState.status = 'offline';
            } else {
                this.syncState.status = 'error';
            }

            this.notify();
        }
    }

    /**
     * Manual sync trigger (resets failure counter)
     */
    async manualSync(): Promise<void> {
        this.syncState.failedAttempts = 0;
        await this.performSync();
    }

    /**
     * Start automatic sync interval
     */
    private startAutoSync(): void {
        this.syncInterval = setInterval(() => {
            if (this.syncState.status !== 'offline') {
                this.performSync().catch(err => logError(err));
            }
        }, config.SYNC_INTERVAL_MS);
    }

    /**
     * Stop automatic sync (for cleanup)
     */
    stop(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Apply server changes to local database
     */
    private async applyServerChanges(
        db: any,
        changes: JobApplication[],
        interviewChanges?: any[]
    ): Promise<void> {
        // Apply application changes
        const appTx = db.transaction('applications', 'readwrite');
        for (const change of changes) {
            const local = await appTx.store.get(change.id);
            if (!local || change.updated_at >= local.updated_at) {
                await appTx.store.put(change);
            }
        }
        await appTx.done;

        // Apply interview changes
        if (interviewChanges && interviewChanges.length > 0) {
            const interviewTx = db.transaction('interviews', 'readwrite');
            for (const change of interviewChanges) {
                const local = await interviewTx.store.get(change.id);
                if (!local || change.updated_at >= local.updated_at) {
                    await interviewTx.store.put(change);
                }
            }
            await interviewTx.done;
        }
    }
}

// Singleton instance
let syncManagerInstance: SyncManager;

export function getSyncManager(): SyncManager {
    if (!syncManagerInstance) {
        syncManagerInstance = new SyncManager();
    }
    return syncManagerInstance;
}

/**
 * Legacy API for backward compatibility with old code
 */
export async function performSync(): Promise<void> {
    await getSyncManager().performSync();
}

export function subscribeToSync(callback: (state: SyncState) => void): () => void {
    return getSyncManager().subscribeToSync(callback);
}

export async function manualSync(): Promise<void> {
    await getSyncManager().manualSync();
}
