import { openDB, IDBPDatabase } from 'idb';
import { JobApplication, NewInterview, Interview } from './types';

const DB_NAME = 'CareerTrackDB';
const DB_VERSION = 4;

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
        db.createObjectStore('interviews', { keyPath: 'id' });
      }

      // Migration from autoIncrement to manual IDs (UUIDs)
      if (oldVersion === 1) {
        if (db.objectStoreNames.contains('applications')) {
          db.deleteObjectStore('applications');
        }
        db.createObjectStore('applications', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('interviews')) {
          db.createObjectStore('interviews', { keyPath: 'id' });
        }
      }

      if (oldVersion === 2) {
        if (!db.objectStoreNames.contains('interviews')) {
          db.createObjectStore('interviews', { keyPath: 'id' });
        }
      }

      // Version 4: dirty bit migration will happen in post-upgrade
    },
  });
}

// Migration to add dirty bit - run after DB opens
async function migrateApplicationsDirtyBit(db: IDBPDatabase) {
  const tx = db.transaction('applications', 'readwrite');
  const store = tx.objectStore('applications');
  const apps = await store.getAll();

  for (const app of apps) {
    let changed = false;
    if (app.dirty === undefined) {
      app.dirty = 1;
      changed = true;
    }
    if (app.applied_date !== undefined) {
      app.status_date = app.applied_date;
      delete app.applied_date;
      changed = true;
    }
    if (changed) {
      store.put(app);
    }
  }

  await tx.done;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
let migrationDone = false;

function getDB() {
  if (!dbPromise) {
    dbPromise = initDB().then(async (db) => {
      // Run post-upgrade migrations
      if (!migrationDone) {
        await migrateApplicationsDirtyBit(db);
        migrationDone = true;
      }
      return db;
    });
  }
  return dbPromise;
}

export async function getApplications(): Promise<JobApplication[]> {
  const db = await getDB();
  const apps = await db.getAll('applications');
  const interviews = await db.getAll('interviews');

  const activeApps = apps.filter(app => !app.is_deleted);

  // Join interviews to applications
  return activeApps.map(app => ({
    ...app,
    interviews: interviews.filter(i => i.application_id === app.id)
  })).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
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
    dirty: 1,
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

export async function getDirtyApplications(): Promise<JobApplication[]> {
  const db = await getDB();
  const allApps = await db.getAll('applications');
  return allApps.filter(app => app.dirty === 1 && !app.is_deleted);
}

export async function clearDirty(id: string) {
  const db = await getDB();
  const app = await db.get('applications', id);
  if (app) {
    app.dirty = 0;
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

export async function applyServerChanges(changes: JobApplication[], interviewChanges?: any[]) {
  const db = await getDB();

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

// Interviews
export async function saveInterview(interview: Partial<Interview> & { application_id: string }): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const existing = interview.id ? await db.get('interviews', interview.id) : null;

  const updatedInterview = {
    ...existing,
    ...interview,
    id: interview.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
    updated_at: now,
    version: existing?.version || 0,
    created_at: existing?.created_at || now
  } as Interview;

  await db.put('interviews', updatedInterview);
  return updatedInterview.id;
}

export async function deleteInterview(id: string) {
  const db = await getDB();
  // For simplicity, we just delete it locally. 
  // In a full sync, we should mark as is_deleted, but interviews table in server doesn't have is_deleted.
  // Actually, let's just delete it locally and on server.
  await db.delete('interviews', id);
  // Optional: signal server
  await fetch(`/api/interviews/${id}`, { method: 'DELETE' }).catch(() => { });
}
