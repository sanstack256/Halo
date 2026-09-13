import type {
    HaloBreadcrumb,
    HaloTagValue,
    HaloUser,
} from "@halo-trace/sdk-types";

export interface ScopeData {
    user?: HaloUser;
    tags?: Record<string, HaloTagValue>;
    contexts?: Record<string, Record<string, unknown>>;
    release?: string;
    environment?: string;
    service?: string;
    deployment?: string;
    baggage?: Record<string, string>;
}

export class Scope {
    private user?: HaloUser;
    private tags: Record<string, HaloTagValue> = {};
    private contexts: Record<string, Record<string, unknown>> = {};
    private release?: string;
    private environment?: string;
    private service?: string;
    private deployment?: string;
    private baggage: Record<string, string> = {};
    private listeners: Array<(scope: Scope) => void> = [];

    constructor(initial?: Partial<ScopeData>) {
        if (initial) {
            this.user = initial.user ? { ...initial.user } : undefined;
            this.tags = initial.tags ? { ...initial.tags } : {};
            this.contexts = initial.contexts ? { ...initial.contexts } : {};
            this.release = initial.release;
            this.environment = initial.environment;
            this.service = initial.service;
            this.deployment = initial.deployment;
            this.baggage = initial.baggage ? { ...initial.baggage } : {};
        }
    }

    public setUser(user: HaloUser | undefined): this {
        this.user = user ? { ...user } : undefined;
        this.notify();
        return this;
    }

    public getUser(): HaloUser | undefined {
        return this.user ? { ...this.user } : undefined;
    }

    public clearUser(): this {
        this.user = undefined;
        this.notify();
        return this;
    }

    public setTag(key: string, value: HaloTagValue): this {
        this.tags[key] = value;
        this.notify();
        return this;
    }

    public setTags(tags: Record<string, HaloTagValue>): this {
        Object.assign(this.tags, tags);
        this.notify();
        return this;
    }

    public removeTag(key: string): this {
        delete this.tags[key];
        this.notify();
        return this;
    }

    public getTags(): Record<string, HaloTagValue> {
        return { ...this.tags };
    }

    public setContext(name: string, data: Record<string, unknown>): this {
        this.contexts[name] = { ...data };
        this.notify();
        return this;
    }

    public setContexts(contexts: Record<string, Record<string, unknown>>): this {
        for (const [k, v] of Object.entries(contexts)) {
            this.contexts[k] = { ...v };
        }
        this.notify();
        return this;
    }

    public getContexts(): Record<string, Record<string, unknown>> {
        return JSON.parse(JSON.stringify(this.contexts));
    }

    public setRelease(release: string | undefined): this {
        this.release = release;
        this.notify();
        return this;
    }

    public getRelease(): string | undefined {
        return this.release;
    }

    public setEnvironment(environment: string | undefined): this {
        this.environment = environment;
        this.notify();
        return this;
    }

    public getEnvironment(): string | undefined {
        return this.environment;
    }

    public setService(service: string | undefined): this {
        this.service = service;
        this.notify();
        return this;
    }

    public getService(): string | undefined {
        return this.service;
    }

    public setDeployment(deployment: string | undefined): this {
        this.deployment = deployment;
        this.notify();
        return this;
    }

    public getDeployment(): string | undefined {
        return this.deployment;
    }

    public setBaggage(key: string, value: string): this {
        this.baggage[key] = value;
        this.notify();
        return this;
    }

    public getBaggage(): Record<string, string> {
        return { ...this.baggage };
    }

    public clone(): Scope {
        const s = new Scope();
        s.user = this.user ? { ...this.user } : undefined;
        s.tags = { ...this.tags };
        s.contexts = JSON.parse(JSON.stringify(this.contexts));
        s.release = this.release;
        s.environment = this.environment;
        s.service = this.service;
        s.deployment = this.deployment;
        s.baggage = { ...this.baggage };
        return s;
    }

    public onScopeChange(listener: (scope: Scope) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener(this);
            } catch {
                // Safeguard against subscriber failures
            }
        }
    }
}
