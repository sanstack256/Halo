import type { HaloBreadcrumb } from "@halo-trace/sdk-types";

export class BreadcrumbRingBuffer {
    private readonly capacity: number;
    private buffer: HaloBreadcrumb[] = [];

    constructor(capacity: number = 100) {
        this.capacity = Math.max(1, capacity);
    }

    public add(breadcrumb: HaloBreadcrumb): void {
        this.buffer.push(breadcrumb);
        if (this.buffer.length > this.capacity) {
            this.buffer.shift();
        }
    }

    public getAll(): HaloBreadcrumb[] {
        return [...this.buffer];
    }

    public clear(): void {
        this.buffer = [];
    }

    public size(): number {
        return this.buffer.length;
    }

    public getCapacity(): number {
        return this.capacity;
    }
}
