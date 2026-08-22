import type { eventWithTime } from "@rrweb/types";

export class ReplayRingBuffer {
    private buffer: eventWithTime[] = [];
    private maxDurationMs: number;

    constructor(maxDurationSeconds = 60) {
        this.maxDurationMs = maxDurationSeconds * 1000;
    }

    add(event: eventWithTime): void {
        this.buffer.push(event);
        this.prune();
    }

    private prune(): void {
        if (this.buffer.length === 0) return;
        const now = Date.now();
        const cutoff = now - this.maxDurationMs;

        // Find the index of the first FullSnapshot event before or at the cutoff window
        // so that replay playback always has a valid initial DOM tree root
        let earliestValidIndex = 0;
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            if (this.buffer[i].timestamp < cutoff) {
                // Keep the most recent full snapshot before cutoff
                if (this.buffer[i].type === 2 /* FullSnapshot */) {
                    earliestValidIndex = i;
                    break;
                }
            }
        }

        if (earliestValidIndex > 0) {
            this.buffer = this.buffer.slice(earliestValidIndex);
        }
    }

    flush(): eventWithTime[] {
        const events = [...this.buffer];
        this.buffer = [];
        return events;
    }

    getAll(): eventWithTime[] {
        return [...this.buffer];
    }

    clear(): void {
        this.buffer = [];
    }

    get length(): number {
        return this.buffer.length;
    }
}
