import type { eventWithTime } from "@rrweb/types";

export class ReplayRingBuffer {
    private buffer: eventWithTime[] = [];
    private maxDurationMs: number;
    private maxEvents: number;

    constructor(maxDurationSeconds = 60, maxEvents = 5000) {
        this.maxDurationMs = Math.max(1000, maxDurationSeconds * 1000);
        this.maxEvents = Math.max(1, maxEvents);
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

        // If a valid FullSnapshot was found, prune everything before it.
        // Include preceding Meta (type 4) if present right before the FullSnapshot.
        if (snapshotIndex > 0) {
            const startIndex = snapshotIndex > 0 && this.buffer[snapshotIndex - 1]?.type === 4
                ? snapshotIndex - 1
                : snapshotIndex;
            this.buffer = this.buffer.slice(startIndex);
        } else if (countNeedsPrune && this.buffer.length > this.maxEvents) {
            // Find any FullSnapshot that leaves at least one snapshot in the remaining window
            const firstSnapshotIdx = this.buffer.findIndex(e => e.type === 2);
            if (firstSnapshotIdx >= 0) {
                // If there's another FullSnapshot later in the buffer, prune up to that one
                const nextSnapshotIdx = this.buffer.slice(firstSnapshotIdx + 1).findIndex(e => e.type === 2);
                if (nextSnapshotIdx >= 0) {
                    const actualIdx = firstSnapshotIdx + 1 + nextSnapshotIdx;
                    const startIndex = actualIdx > 0 && this.buffer[actualIdx - 1]?.type === 4
                        ? actualIdx - 1
                        : actualIdx;
                    this.buffer = this.buffer.slice(startIndex);
                } else {
                    // Only one snapshot exists and buffer exceeded maxEvents:
                    // Retain the initial FullSnapshot at index 0 and prune oldest incremental events
                    const snapshot = this.buffer[firstSnapshotIdx];
                    const excess = this.buffer.length - this.maxEvents;
                    const remaining = this.buffer.slice(firstSnapshotIdx + 1 + excess);
                    this.buffer = [snapshot, ...remaining];
                }
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

