import type { eventWithTime } from "@rrweb/types";

export class ReplayRingBuffer {
    private buffer: eventWithTime[] = [];
    private maxDurationMs: number;
    private maxEvents: number;

    constructor(maxDurationSeconds = 60, maxEvents = 5000) {
        this.maxDurationMs = Math.max(1000, maxDurationSeconds * 1000);
        this.maxEvents = Math.max(100, maxEvents);
    }

    add(event: eventWithTime): void {
        this.buffer.push(event);
        this.prune(event.timestamp);
    }

    /**
     * Prunes events that are older than maxDurationMs or beyond maxEvents,
     * while rigorously ensuring that an initial FullSnapshot (type 2) or Meta (type 4)
     * is preserved at the beginning of the buffer so DOM reconstruction never fails.
     */
    public prune(referenceTimestamp?: number): void {
        if (this.buffer.length <= 1) return;

        const now = referenceTimestamp ?? (this.buffer[this.buffer.length - 1]?.timestamp || Date.now());
        const cutoff = now - this.maxDurationMs;

        // 1. Check if pruning is needed due to time or event count limit
        const timeNeedsPrune = this.buffer[0].timestamp < cutoff;
        const countNeedsPrune = this.buffer.length > this.maxEvents;

        if (!timeNeedsPrune && !countNeedsPrune) {
            return;
        }

        // Find the most recent FullSnapshot (type 2) that is at or before cutoff
        let snapshotIndex = -1;
        for (let i = this.buffer.length - 1; i >= 0; i--) {
            const ev = this.buffer[i];
            if (ev.type === 2 /* FullSnapshot */) {
                if (ev.timestamp <= cutoff || (countNeedsPrune && this.buffer.length - i <= this.maxEvents)) {
                    snapshotIndex = i;
                    break;
                }
            }
        }

        // If a valid FullSnapshot before/at cutoff was found, prune everything before it
        if (snapshotIndex > 0) {
            this.buffer = this.buffer.slice(snapshotIndex);
        } else if (countNeedsPrune && this.buffer.length > this.maxEvents) {
            // If the session has run for a while without a new full snapshot,
            // we must retain the very first FullSnapshot (to avoid rendering a blank page)
            // and drop the oldest incremental events after it.
            const firstSnapshotIdx = this.buffer.findIndex(e => e.type === 2);
            if (firstSnapshotIdx >= 0) {
                const snapshot = this.buffer[firstSnapshotIdx];
                const excess = this.buffer.length - this.maxEvents;
                const remaining = this.buffer.slice(firstSnapshotIdx + 1 + excess);
                this.buffer = [snapshot, ...remaining];
            } else {
                this.buffer = this.buffer.slice(this.buffer.length - this.maxEvents);
            }
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

