/**
 * View state manager for UI state separation
 * Keeps UI state decoupled from business logic
 */

import { JobApplicationModel, InterviewModel } from './models';
import { NewApplication, NewInterview } from './types';
import { config } from './config';

export type ViewType = 'main' | 'form' | 'interview';

/**
 * Manages the view state and form data
 */
export class ViewStateManager {
    private view: ViewType = 'main';
    private searchQuery: string = '';
    private activeFilter: string | null = null;
    private editingApp: JobApplicationModel | null = null;
    private editingInterview: InterviewModel | null = null;
    private deleteConfirmId: string | null = null;
    private deleteInterviewId: string | null = null;
    private loading: boolean = true;

    private formData: NewApplication = this.getDefaultFormData();
    private interviewData: NewInterview = this.getDefaultInterviewData('');

    private listeners: Set<() => void> = new Set();

    /**
     * Subscribe to state changes
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state change
     */
    private notify(): void {
        this.listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.error('Error in view state listener:', error);
            }
        });
    }

    // View management
    getView(): ViewType {
        return this.view;
    }

    setView(view: ViewType): void {
        this.view = view;
        this.notify();
    }

    isMainView(): boolean {
        return this.view === 'main';
    }

    isFormView(): boolean {
        return this.view === 'form';
    }

    isInterviewView(): boolean {
        return this.view === 'interview';
    }

    // Search and filter
    getSearchQuery(): string {
        return this.searchQuery;
    }

    setSearchQuery(query: string): void {
        this.searchQuery = query;
        this.notify();
    }

    getActiveFilter(): string | null {
        return this.activeFilter;
    }

    setActiveFilter(filter: string | null): void {
        this.activeFilter = filter;
        this.notify();
    }

    // Editing state
    getEditingApp(): JobApplicationModel | null {
        return this.editingApp;
    }

    setEditingApp(app: JobApplicationModel | null): void {
        this.editingApp = app;
        this.notify();
    }

    getEditingInterview(): InterviewModel | null {
        return this.editingInterview;
    }

    setEditingInterview(interview: InterviewModel | null): void {
        this.editingInterview = interview;
        this.notify();
    }

    // Delete confirmation
    getDeleteConfirmId(): string | null {
        return this.deleteConfirmId;
    }

    setDeleteConfirmId(id: string | null): void {
        this.deleteConfirmId = id;
        this.notify();
    }

    getDeleteInterviewId(): string | null {
        return this.deleteInterviewId;
    }

    setDeleteInterviewId(id: string | null): void {
        this.deleteInterviewId = id;
        this.notify();
    }

    // Loading state
    isLoading(): boolean {
        return this.loading;
    }

    setLoading(loading: boolean): void {
        this.loading = loading;
        this.notify();
    }

    // Form data
    getFormData(): NewApplication {
        return { ...this.formData };
    }

    setFormData(data: NewApplication): void {
        this.formData = { ...data };
        this.notify();
    }

    updateFormField<K extends keyof NewApplication>(key: K, value: NewApplication[K]): void {
        this.formData[key] = value;
        this.notify();
    }

    resetFormData(): void {
        this.formData = this.getDefaultFormData();
        this.editingApp = null;
        this.notify();
    }

    loadFormDataFromApp(app: JobApplicationModel): void {
        this.formData = {
            company: app.company,
            position: app.position,
            status: app.status,
            applied_date: app.applied_date,
            url: app.url,
            location: app.location,
            location_type: app.location_type,
            salary: app.salary,
            salary_min: app.salary_min,
            salary_max: app.salary_max,
            desired_salary_min: app.desired_salary_min,
            desired_salary_max: app.desired_salary_max,
            notes: app.notes,
            pdf_data: app.pdf_data,
        };
        this.editingApp = app;
        this.notify();
    }

    // Interview form data
    getInterviewData(): NewInterview {
        return { ...this.interviewData };
    }

    setInterviewData(data: NewInterview): void {
        this.interviewData = { ...data };
        this.notify();
    }

    updateInterviewField<K extends keyof NewInterview>(key: K, value: NewInterview[K]): void {
        this.interviewData[key] = value;
        this.notify();
    }

    resetInterviewData(applicationId: string): void {
        this.interviewData = this.getDefaultInterviewData(applicationId);
        this.editingInterview = null;
        this.notify();
    }

    loadInterviewDataFromModel(interview: InterviewModel): void {
        this.interviewData = {
            application_id: interview.application_id,
            date: interview.date,
            time: interview.time,
            type: interview.type,
            duration: interview.duration,
            notes: interview.notes,
        };
        this.editingInterview = interview;
        this.notify();
    }

    // State getters for stats calculation
    calculateStats(apps: JobApplicationModel[]): {
        total: number;
        applied: number;
        interviewing: number;
        offers: number;
        closed: number;
    } {
        return {
            total: apps.length,
            applied: apps.filter(a => a.status === 'Applied').length,
            interviewing: apps.filter(a => a.status === 'Interviewing').length,
            offers: apps.filter(a => a.status === 'Offer').length,
            closed: apps.filter(a => a.status === 'Rejected' || a.status === 'Withdrawn').length,
        };
    }

    /**
     * Reset all UI state to initial state
     */
    reset(): void {
        this.view = 'main';
        this.searchQuery = '';
        this.activeFilter = null;
        this.editingApp = null;
        this.editingInterview = null;
        this.deleteConfirmId = null;
        this.deleteInterviewId = null;
        this.loading = true;
        this.formData = this.getDefaultFormData();
        this.interviewData = this.getDefaultInterviewData('');
        this.notify();
    }

    private getDefaultFormData(): NewApplication {
        return {
            company: '',
            position: '',
            status: config.DEFAULT_APPLICATION_STATUS,
            applied_date: new Date().toISOString().split('T')[0],
            url: '',
            location: '',
            location_type: config.DEFAULT_LOCATION_TYPE,
            salary: '',
            salary_min: undefined,
            salary_max: undefined,
            desired_salary_min: undefined,
            desired_salary_max: undefined,
            notes: '',
            pdf_data: '',
        };
    }

    private getDefaultInterviewData(applicationId: string): NewInterview {
        return {
            application_id: applicationId,
            date: new Date().toISOString().split('T')[0],
            time: config.DEFAULT_INTERVIEW_TIME,
            type: config.DEFAULT_INTERVIEW_TYPE,
            duration: config.DEFAULT_INTERVIEW_DURATION,
            notes: '',
        };
    }
}

// Singleton instance
let viewStateInstance: ViewStateManager;

export function getViewStateManager(): ViewStateManager {
    if (!viewStateInstance) {
        viewStateInstance = new ViewStateManager();
    }
    return viewStateInstance;
}
