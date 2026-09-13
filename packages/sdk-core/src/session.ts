export function generateSessionId(): string {
    return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SessionManager {
    private sessionId: string;
    private startedAt: string;
    private lastSeenAt: string;
    private sequence: number = 0;
    private crashed: boolean = false;

    constructor(existingSessionId?: string) {
        this.sessionId = existingSessionId || generateSessionId();
        this.startedAt = new Date().toISOString();
        this.lastSeenAt = this.startedAt;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getStartedAt(): string {
        return this.startedAt;
    }

    public getLastSeenAt(): string {
        return this.lastSeenAt;
    }

    public nextSequence(): number {
        return this.sequence++;
    }

    public touch(): void {
        this.lastSeenAt = new Date().toISOString();
    }

    public markCrashed(): void {
        this.crashed = true;
        this.touch();
    }

    public isCrashed(): boolean {
        return this.crashed;
    }

    public rotate(): string {
        this.sessionId = generateSessionId();
        this.startedAt = new Date().toISOString();
        this.lastSeenAt = this.startedAt;
        this.sequence = 0;
        this.crashed = false;
        return this.sessionId;
    }
}
