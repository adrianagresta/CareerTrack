/**
 * Event system for decoupled communication between components
 */

export type EventListener<T = any> = (event: T) => void | Promise<void>;

export interface DomainEvent {
    readonly type: string;
    readonly timestamp: number;
}

/**
 * Simple EventBus for pub/sub communication
 */
export class EventBus {
    private listeners: Map<string, Set<EventListener>> = new Map();

    /**
     * Subscribe to events of a specific type
     */
    on<T extends DomainEvent>(eventType: string, listener: EventListener<T>): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        const listenerSet = this.listeners.get(eventType)!;
        listenerSet.add(listener);

        // Return unsubscribe function
        return () => {
            listenerSet.delete(listener);
            if (listenerSet.size === 0) {
                this.listeners.delete(eventType);
            }
        };
    }

    /**
     * Subscribe to a single event (auto-unsubscribe after first trigger)
     */
    once<T extends DomainEvent>(eventType: string, listener: EventListener<T>): () => void {
        const unsubscribe = this.on<T>(eventType, async (event: T) => {
            unsubscribe();
            await listener(event);
        });
        return unsubscribe;
    }

    /**
     * Emit an event to all listeners
     */
    async emit<T extends DomainEvent>(event: T): Promise<void> {
        const listeners = this.listeners.get(event.type);
        if (!listeners) return;

        await Promise.all(
            Array.from(listeners).map(listener =>
                Promise.resolve(listener(event)).catch(err =>
                    console.error(`Error in event listener for ${event.type}:`, err)
                )
            )
        );
    }

    /**
     * Clear all listeners (for testing/cleanup)
     */
    clear(): void {
        this.listeners.clear();
    }

    /**
     * Get listener count for a specific event type
     */
    listenerCount(eventType: string): number {
        return this.listeners.get(eventType)?.size ?? 0;
    }
}

// Application domain events
export interface ApplicationSavedEvent extends DomainEvent {
    readonly type: 'application:saved';
    readonly applicationId: string;
    readonly isNew: boolean;
}

export interface ApplicationDeletedEvent extends DomainEvent {
    readonly type: 'application:deleted';
    readonly applicationId: string;
}

export interface InterviewSavedEvent extends DomainEvent {
    readonly type: 'interview:saved';
    readonly interviewId: string;
    readonly applicationId: string;
    readonly isNew: boolean;
}

export interface InterviewDeletedEvent extends DomainEvent {
    readonly type: 'interview:deleted';
    readonly interviewId: string;
    readonly applicationId: string;
}

export interface SyncStateChangedEvent extends DomainEvent {
    readonly type: 'sync:stateChanged';
    readonly status: 'idle' | 'syncing' | 'offline' | 'error' | 'success';
    readonly lastSyncTime: number | null;
    readonly failedAttempts: number;
}

export interface ApplicationsLoadedEvent extends DomainEvent {
    readonly type: 'applications:loaded';
    readonly applicationCount: number;
}

// Singleton instance
let eventBusInstance: EventBus;

export function getEventBus(): EventBus {
    if (!eventBusInstance) {
        eventBusInstance = new EventBus();
    }
    return eventBusInstance;
}
