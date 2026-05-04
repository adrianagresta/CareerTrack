/**
 * Centralized configuration for the application
 */
export class ApplicationConfig {
    // Sync settings
    readonly SYNC_INTERVAL_MS = 30000; // 30 seconds
    readonly MAX_SYNC_ATTEMPTS = 3;

    // File upload settings
    readonly MAX_FILE_SIZE_MB = 5;
    readonly ALLOWED_FILE_TYPES = ['application/pdf'];

    // Database settings
    readonly DB_NAME = 'CareerTrackDB';
    readonly DB_VERSION = 3;

    // Sync status timeout
    readonly SYNC_SUCCESS_DISPLAY_MS = 3000;

    // Default form values
    readonly DEFAULT_APPLICATION_STATUS = 'Applied';
    readonly DEFAULT_LOCATION_TYPE = 'OnSite';
    readonly DEFAULT_INTERVIEW_TYPE = 'Phone Screen';
    readonly DEFAULT_INTERVIEW_DURATION = 30;
    readonly DEFAULT_INTERVIEW_TIME = '09:00';

    private static instance: ApplicationConfig;

    static getInstance(): ApplicationConfig {
        if (!ApplicationConfig.instance) {
            ApplicationConfig.instance = new ApplicationConfig();
        }
        return ApplicationConfig.instance;
    }

    private constructor() {
        // Prevent instantiation
    }
}

export const config = ApplicationConfig.getInstance();
