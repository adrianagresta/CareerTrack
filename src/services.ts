/**
 * Application service layer for business logic
 * Orchestrates repositories and domain models
 */

import { IDBPDatabase } from 'idb';
import { ApplicationRepository, InterviewRepository, SyncMetadataRepository } from './repositories';
import { JobApplicationModel, InterviewModel } from './models';
import { NewApplication, NewInterview } from './types';
import { getEventBus, ApplicationSavedEvent, ApplicationDeletedEvent } from './eventBus';
import { ValidationError, OperationFailedError, logError } from './errors';
import { config } from './config';

/**
 * Service for managing job applications
 */
export class ApplicationService {
    private appRepo: ApplicationRepository;
    private interviewRepo: InterviewRepository;
    private eventBus = getEventBus();

    constructor(db: IDBPDatabase) {
        this.appRepo = new ApplicationRepository(db);
        this.interviewRepo = new InterviewRepository(db);
    }

    /**
     * Get all applications with their interviews
     */
    async getAllApplications(): Promise<JobApplicationModel[]> {
        try {
            return await this.appRepo.getAllWithInterviews(this.interviewRepo);
        } catch (error) {
            logError(error);
            throw new OperationFailedError('Load applications', 'Failed to load applications');
        }
    }

    /**
     * Get a single application by ID
     */
    async getApplication(id: string): Promise<JobApplicationModel | undefined> {
        try {
            const app = await this.appRepo.getById(id);
            if (app) {
                app.interviews = await this.interviewRepo.getByApplicationId(id);
            }
            return app;
        } catch (error) {
            logError(error);
            throw new OperationFailedError('Load application', 'Failed to load application');
        }
    }

    /**
     * Create or update an application
     */
    async saveApplication(data: NewApplication & { id?: string }): Promise<string> {
        try {
            const id = data.id || this.generateId();
            const existing = data.id ? await this.appRepo.getById(data.id) : null;
            const isNew = !existing;

            // Create model from data
            const appModel = new JobApplicationModel({
                id,
                company: data.company,
                position: data.position,
                status: data.status || config.DEFAULT_APPLICATION_STATUS,
                applied_date: data.applied_date,
                url: data.url || '',
                location: data.location || '',
                location_type: data.location_type || config.DEFAULT_LOCATION_TYPE,
                salary: data.salary || '',
                salary_min: data.salary_min,
                salary_max: data.salary_max,
                desired_salary_min: data.desired_salary_min,
                desired_salary_max: data.desired_salary_max,
                notes: data.notes || '',
                pdf_data: data.pdf_data,
                version: existing?.version ?? 0,
                is_deleted: existing?.is_deleted ?? 0,
                updated_at: Date.now(),
                created_at: existing?.created_at ?? new Date().toISOString(),
            });

            const savedId = await this.appRepo.save(appModel);

            // Emit event
            await this.eventBus.emit<ApplicationSavedEvent>({
                type: 'application:saved',
                timestamp: Date.now(),
                applicationId: savedId,
                isNew,
            });

            return savedId;
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            logError(error);
            throw new OperationFailedError('Save application', 'Failed to save application');
        }
    }

    /**
     * Delete an application
     */
    async deleteApplication(id: string): Promise<void> {
        try {
            await this.appRepo.delete(id);

            await this.eventBus.emit<ApplicationDeletedEvent>({
                type: 'application:deleted',
                timestamp: Date.now(),
                applicationId: id,
            });
        } catch (error) {
            logError(error);
            throw new OperationFailedError('Delete application', 'Failed to delete application');
        }
    }

    /**
     * Filter applications based on search and filter criteria
     */
    filterApplications(
        apps: JobApplicationModel[],
        searchQuery: string,
        activeFilter: string | null
    ): JobApplicationModel[] {
        return apps.filter(app => {
            const matchesSearch =
                app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.location.toLowerCase().includes(searchQuery.toLowerCase());

            if (!activeFilter || activeFilter === 'Total') return matchesSearch;

            if (activeFilter === 'Closed') {
                return matchesSearch && (app.status === 'Rejected' || app.status === 'Withdrawn');
            }

            return matchesSearch && app.status === activeFilter;
        });
    }

    private generateId(): string {
        return typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 11);
    }
}

/**
 * Service for managing interviews
 */
export class InterviewService {
    private interviewRepo: InterviewRepository;
    private appRepo: ApplicationRepository;
    private eventBus = getEventBus();

    constructor(db: IDBPDatabase) {
        this.interviewRepo = new InterviewRepository(db);
        this.appRepo = new ApplicationRepository(db);
    }

    /**
     * Create or update an interview
     */
    async saveInterview(
        data: NewInterview & { id?: string },
        appService: ApplicationService
    ): Promise<{ interviewId: string; statusChanged: boolean }> {
        try {
            const id = data.id || this.generateId();
            const existing = data.id ? await this.interviewRepo.getById(data.id) : null;
            const isNew = !existing;

            const interviewModel = new InterviewModel({
                id,
                application_id: data.application_id,
                date: data.date,
                time: data.time,
                type: data.type,
                duration: data.duration,
                notes: data.notes,
                version: existing?.version ?? 0,
                updated_at: Date.now(),
                created_at: existing?.created_at ?? Date.now(),
            });

            const savedId = await this.interviewRepo.save(interviewModel);

            // Check if we should auto-update application status
            let statusChanged = false;
            if (isNew) {
                const app = await appService.getApplication(data.application_id);
                if (app && app.shouldAutoTransitionToInterviewing()) {
                    app.transitionToInterviewing();
                    await this.appRepo.save(app);
                    statusChanged = true;
                }
            }

            await this.eventBus.emit({
                type: 'interview:saved',
                timestamp: Date.now(),
                interviewId: savedId,
                applicationId: data.application_id,
                isNew,
            });

            return { interviewId: savedId, statusChanged };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            logError(error);
            throw new OperationFailedError('Save interview', 'Failed to save interview');
        }
    }

    /**
     * Delete an interview
     */
    async deleteInterview(id: string): Promise<void> {
        try {
            const interview = await this.interviewRepo.getById(id);
            if (!interview) return;

            await this.interviewRepo.delete(id);

            await this.eventBus.emit({
                type: 'interview:deleted',
                timestamp: Date.now(),
                interviewId: id,
                applicationId: interview.application_id,
            });
        } catch (error) {
            logError(error);
            throw new OperationFailedError('Delete interview', 'Failed to delete interview');
        }
    }

    /**
     * Get interviews for an application
     */
    async getApplicationInterviews(applicationId: string): Promise<InterviewModel[]> {
        try {
            return await this.interviewRepo.getByApplicationId(applicationId);
        } catch (error) {
            logError(error);
            throw new OperationFailedError('Load interviews', 'Failed to load interviews');
        }
    }

    private generateId(): string {
        return typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 11);
    }
}
