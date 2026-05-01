import { openDB, IDBPDatabase } from 'idb';
import { JobApplication } from './types';

const DB_NAME = 'CareerTrackDB';
const DB_VERSION = 2;

export interface SyncMeta {
  key: string;
  value: number;
}

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('applications', { keyPath: 'id' });
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
      
      // Migration from autoIncrement to manual IDs (UUIDs)
      if (oldVersion === 1) {
        if (db.objectStoreNames.contains('applications')) {
          db.deleteObjectStore('applications');
        }
        db.createObjectStore('applications', { keyPath: 'id' });
      }
    },
  });
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) dbPromise = initDB();
  return dbPromise;
}

export async function getApplications(): Promise<JobApplication[]> {
  const db = await getDB();
  const apps = await db.getAll('applications');
  return apps.filter(app => !app.is_deleted).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
}

export async function getApplication(id: string): Promise<JobApplication | undefined> {
  const db = await getDB();
  return db.get('applications', id);
}

export async function saveApplication(app: Partial<JobApplication>): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const existing = app.id ? await db.get('applications', app.id) : null;
  
  const updatedApp = {
    ...existing,
    ...app,
    id: app.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
    updated_at: now,
    version: existing?.version || 0,
    is_deleted: app.is_deleted || 0,
    created_at: existing?.created_at || new Date().toISOString()
  } as JobApplication;

  await db.put('applications', updatedApp);
  return updatedApp.id;
}

export async function deleteApplication(id: string) {
  const db = await getDB();
  const app = await db.get('applications', id);
  if (app) {
    app.is_deleted = 1;
    app.updated_at = Date.now();
    await db.put('applications', app);
  }
}

export async function getSyncMeta(key: string): Promise<number> {
  const db = await getDB();
  const meta = await db.get('sync_meta', key);
  return meta ? meta.value : 0;
}

export async function setSyncMeta(key: string, value: number) {
  const db = await getDB();
  await db.put('sync_meta', { key, value });
}

export async function getPendingChanges(lastSyncVersion: number): Promise<JobApplication[]> {
  const db = await getDB();
  const all = await db.getAll('applications');
  // Pending changes are those with version 0 (new/updated locally) 
  // or those updated after the last sync (though versioning is better)
  // Actually, since server assigns versions, anything with version 0 or 
  // anything where updated_at is very recent might be a candidate.
  // Better: track a 'needs_sync' flag or just send everything with version 0.
  return all.filter(app => app.version === 0 || app.updated_at > 0); 
  // For simplicity in this demo, we'll send everything that might be new.
  // A more robust way would be a separate 'outbox' store.
}

export async function applyServerChanges(changes: JobApplication[]) {
  const db = await getDB();
  const tx = db.transaction('applications', 'readwrite');
  for (const change of changes) {
    const local = await tx.store.get(change.id);
    if (!local || change.updated_at >= local.updated_at) {
      await tx.store.put(change);
    }
  }
  await tx.done;
}
