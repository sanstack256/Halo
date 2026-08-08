export type UploadFunction = (
    event: unknown
) => Promise<void>;

export class EventQueue {
    private readonly queue: unknown[] = [];

    private processing = false;

    private upload: UploadFunction;

    constructor(upload: UploadFunction) {
        this.upload = upload;
    }

    async enqueue(event: unknown) {
        this.queue.push(event);

        if (!this.processing) {
            await this.process();
        }
    }

    async flush() {
        while (
            this.processing ||
            this.queue.length > 0
        ) {
            await new Promise((resolve) =>
                setTimeout(resolve, 10)
            );
        }
    }

    private async process() {
        this.processing = true;

        while (this.queue.length > 0) {
            const event = this.queue.shift();

            if (!event) {
                continue;
            }

            try {
                await this.upload(event);
            } catch (error) {
                console.error(
                    "[Halo] Failed to upload event:",
                    error
                );

                // Later:
                // retry
                // exponential backoff
                // offline cache
            }
        }

        this.processing = false;
    }
}