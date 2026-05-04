/**
 * Domain models with encapsulated business logic
 */

import { ApplicationStatus, LocationType, InterviewType } from './types';
import { ValidationError } from './errors';

/**
 * Represents a job application with business logic and state management
 */
export class JobApplicationModel {
    readonly id: string;
    readonly company: string;
    readonly position: string;
    status: ApplicationStatus;
    readonly applied_date: string;
    readonly url: string;
    readonly location: string;
    readonly location_type: LocationType;
    readonly salary: string;
    readonly salary_min?: number;
    readonly salary_max?: number;
    readonly desired_salary_min?: number;
    readonly desired_salary_max?: number;
    readonly notes: string;
    readonly pdf_data?: string;
    readonly version: number;
    readonly is_deleted: number;
    readonly updated_at: number;
    readonly created_at: string;
    interviews: InterviewModel[] = [];

    constructor(data: {
        id: string;
        company: string;
        position: string;
        status: ApplicationStatus;
        applied_date: string;
        url: string;
        location: string;
        location_type: LocationType;
        salary: string;
        salary_min?: number;
        salary_max?: number;
        desired_salary_min?: number;
        desired_salary_max?: number;
        notes: string;
        pdf_data?: string;
        version: number;
        is_deleted: number;
        updated_at: number;
        created_at: string;
    }) {
        this.validate(data);
        Object.assign(this, data);
    }

    private validate(data: any): void {
        if (!data.company || !data.company.trim()) {
            throw new ValidationError('Company name is required');
        }
        if (!data.position || !data.position.trim()) {
            throw new ValidationError('Position is required');
        }
        if (!data.applied_date) {
            throw new ValidationError('Applied date is required');
        }
    }

    /**
     * Determine if this application should automatically transition to Interviewing status
     */
    shouldAutoTransitionToInterviewing(): boolean {
        return this.status === 'Applied' && (!this.interviews || this.interviews.length === 0);
    }

    /**
     * Transition to interviewing status
     */
    transitionToInterviewing(): void {
        if (this.status === 'Applied' || this.status === 'Wishlist') {
            this.status = 'Interviewing';
        }
    }

    /**
     * Get the most recent interview
     */
    getMostRecentInterview(): InterviewModel | undefined {
        if (!this.interviews || this.interviews.length === 0) return undefined;
        return [...this.interviews].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
    }

    /**
     * Check if application can be deleted
     */
    canDelete(): boolean {
        return this.is_deleted === 0;
    }

    /**
     * Get total interview count
     */
    getInterviewCount(): number {
        return this.interviews?.length ?? 0;
    }

    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        return {
            id: this.id,
            company: this.company,
            position: this.position,
            status: this.status,
            applied_date: this.applied_date,
            url: this.url,
            location: this.location,
            location_type: this.location_type,
            salary: this.salary,
            salary_min: this.salary_min,
            salary_max: this.salary_max,
            desired_salary_min: this.desired_salary_min,
            desired_salary_max: this.desired_salary_max,
            notes: this.notes,
            pdf_data: this.pdf_data,
            version: this.version,
            is_deleted: this.is_deleted,
            updated_at: this.updated_at,
            created_at: this.created_at,
        };
    }
}

/**
 * Represents an interview with business logic
 */
export class InterviewModel {
    readonly id: string;
    readonly application_id: string;
    readonly date: string;
    readonly time: string;
    readonly type: InterviewType;
    readonly duration: number;
    readonly notes: string;
    readonly version: number;
    readonly updated_at: number;
    readonly created_at: number;

    constructor(data: {
        id: string;
        application_id: string;
        date: string;
        time: string;
        type: InterviewType;
        duration: number;
        notes: string;
        version: number;
        updated_at: number;
        created_at: number;
    }) {
        this.validate(data);
        Object.assign(this, data);
    }

    private validate(data: any): void {
        if (!data.application_id) {
            throw new ValidationError('Application ID is required for interview');
        }
        if (!data.date) {
            throw new ValidationError('Interview date is required');
        }
        if (!data.time) {
            throw new ValidationError('Interview time is required');
        }
        if (!data.duration || data.duration <= 0) {
            throw new ValidationError('Interview duration must be greater than 0');
        }
    }

    /**
     * Get formatted datetime
     */
    getDateTimeString(): string {
        return `${this.date} at ${this.time}`;
    }

    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        return {
            id: this.id,
            application_id: this.application_id,
            date: this.date,
            time: this.time,
            type: this.type,
            duration: this.duration,
            notes: this.notes,
            version: this.version,
            updated_at: this.updated_at,
            created_at: this.created_at,
        };
    }
}
