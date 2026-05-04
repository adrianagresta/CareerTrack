/**
 * Repository pattern for data access layer
 * Abstracts persistence details from business logic
 */

import { IDBPDatabase } from 'idb';
import { JobApplicationModel, InterviewModel } from './models';
import { JobApplication, NewApplication, Interview, NewInterview } from './types';
import { RepositoryError, NotFoundError } from './errors';

/**
 * Base repository interface defining CRUD operations
 */
export interface IRepository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T | undefined>;
    save(entity: T): Promise<string>;
    delete(id: string): Promise<void>;
}

/**
 * Repository for job applications
 */
export class ApplicationRepository implements IRepository<JobApplicationModel> {
    constructor(private db: IDBPDatabase, private storeName: string = 'applications') { }

    async getAll(): Promise<JobApplicationModel[]> {
        try {
            const apps = await this.db.getAll(this.storeName) as JobApplication[];
            const activeApps = apps.filter(app => !app.is_deleted);
            return activeApps.map(app => new JobApplicationModel(app));
        } catch (error) {
            throw new RepositoryError('Failed to fetch all applications', { originalError: error });
        }
    }

    async getById(id: string): Promise<JobApplicationModel | undefined> {
        try {
            const app = await this.db.get(this.storeName, id) as JobApplication | undefined;
            if (!app) return undefined;
            return new JobApplicationModel(app);
        } catch (error) {
            throw new RepositoryError('Failed to fetch application', { id, originalError: error });
        }
    }

    async save(app: JobApplicationModel): Promise<string> {
        try {
            const now = Date.now();
            const existingData = await this.db.get(this.storeName, app.id) as JobApplication | undefined;

            const appData: JobApplication = {
                ...app.toJSON(),
                updated_at: now,
                version: existingData?.version ?? 0,
                created_at: existingData?.created_at ?? new Date().toISOString(),
            };

            await this.db.put(this.storeName, appData);
            return appData.id;
        } catch (error) {
            throw new RepositoryError('Failed to save application', { id: app.id, originalError: error });
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const app = await this.db.get(this.storeName, id) as JobApplication | undefined;
            if (!app) {
                throw new NotFoundError('JobApplication', id);
            }
            app.is_deleted = 1;
            app.updated_at = Date.now();
            await this.db.put(this.storeName, app);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            throw new RepositoryError('Failed to delete application', { id, originalError: error });
        }
    }

    /**
     * Get applications with their interviews joined
     */
    async getAllWithInterviews(interviewRepo: InterviewRepository): Promise<JobApplicationModel[]> {
        try {
            const apps = await this.getAll();
            const interviews = await interviewRepo.getAll();

            apps.forEach(app => {
                app.interviews = interviews.filter(i => i.application_id === app.id);
            });

            return apps.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
        } catch (error) {
            throw new RepositoryError('Failed to fetch applications with interviews', { originalError: error });
        }
    }
}

/**
 * Repository for interviews
 */
export class InterviewRepository implements IRepository<InterviewModel> {
    constructor(private db: IDBPDatabase, private storeName: string = 'interviews') { }

    async getAll(): Promise<InterviewModel[]> {
        try {
            const interviews = await this.db.getAll(this.storeName) as Interview[];
            return interviews.map(i => new InterviewModel(i));
        } catch (error) {
            throw new RepositoryError('Failed to fetch all interviews', { originalError: error });
        }
    }

    async getById(id: string): Promise<InterviewModel | undefined> {
        try {
            const interview = await this.db.get(this.storeName, id) as Interview | undefined;
            if (!interview) return undefined;
            return new InterviewModel(interview);
        } catch (error) {
            throw new RepositoryError('Failed to fetch interview', { id, originalError: error });
        }
    }

    async save(interview: InterviewModel): Promise<string> {
        try {
            const now = Date.now();
            const existingData = await this.db.get(this.storeName, interview.id) as Interview | undefined;

            const interviewData: Interview = {
                ...interview.toJSON(),
                updated_at: now,
                version: existingData?.version ?? 0,
                created_at: existingData?.created_at ?? now,
            };

            await this.db.put(this.storeName, interviewData);
            return interviewData.id;
        } catch (error) {
            throw new RepositoryError('Failed to save interview', { id: interview.id, originalError: error });
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const interview = await this.db.get(this.storeName, id);
            if (!interview) {
                throw new NotFoundError('Interview', id);
            }
            await this.db.delete(this.storeName, id);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            throw new RepositoryError('Failed to delete interview', { id, originalError: error });
        }
    }

    /**
     * Get interviews for a specific application
     */
    async getByApplicationId(applicationId: string): Promise<InterviewModel[]> {
        try {
            const allInterviews = await this.getAll();
            return allInterviews.filter(i => i.application_id === applicationId);
        } catch (error) {
            throw new RepositoryError('Failed to fetch interviews for application', { applicationId, originalError: error });
        }
    }
}

/**
 * Repository for sync metadata
 */
export class SyncMetadataRepository {
    constructor(private db: IDBPDatabase, private storeName: string = 'sync_meta') { }

    async get(key: string): Promise<number> {
        try {
            const meta = await this.db.get(this.storeName, key) as { key: string; value: number } | undefined;
            return meta ? meta.value : 0;
        } catch (error) {
            throw new RepositoryError('Failed to fetch sync metadata', { key, originalError: error });
        }
    }

    async set(key: string, value: number): Promise<void> {
        try {
            await this.db.put(this.storeName, { key, value });
        } catch (error) {
            throw new RepositoryError('Failed to save sync metadata', { key, value, originalError: error });
        }
    }
}
