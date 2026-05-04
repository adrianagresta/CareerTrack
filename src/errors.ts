/**
 * Custom error classes for better error handling and categorization
 */

export class ApplicationError extends Error {
    readonly code: string;
    readonly context?: Record<string, any>;

    constructor(code: string, message: string, context?: Record<string, any>) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'ApplicationError';
    }
}

export class RepositoryError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super('REPOSITORY_ERROR', message, context);
        this.name = 'RepositoryError';
    }
}

export class ValidationError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super('VALIDATION_ERROR', message, context);
        this.name = 'ValidationError';
    }
}

export class SyncError extends ApplicationError {
    constructor(message: string, context?: Record<string, any>) {
        super('SYNC_ERROR', message, context);
        this.name = 'SyncError';
    }
}

export class NotFoundError extends ApplicationError {
    constructor(resource: string, id: string) {
        super('NOT_FOUND', `${resource} with id ${id} not found`, { resource, id });
        this.name = 'NotFoundError';
    }
}

export class OperationFailedError extends ApplicationError {
    constructor(operation: string, reason: string, context?: Record<string, any>) {
        super('OPERATION_FAILED', `${operation} failed: ${reason}`, context);
        this.name = 'OperationFailedError';
    }
}

export function isApplicationError(error: unknown): error is ApplicationError {
    return error instanceof ApplicationError;
}

export function logError(error: unknown): void {
    if (isApplicationError(error)) {
        console.error(`[${error.code}] ${error.message}`, error.context);
    } else if (error instanceof Error) {
        console.error(error.message, error.stack);
    } else {
        console.error('Unknown error:', error);
    }
}
