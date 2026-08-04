import { HaloClient } from "./client";
import type { HaloOptions } from "./types";

export class Halo {
    private client: HaloClient;

    constructor(options: HaloOptions) {
        this.client = new HaloClient(
            options.endpoint ??
            "http://localhost:3000/api",
            options.apiKey
        );
    }

    async captureMessage(message: string) {
        return this.client.post("/ingest/message", {
            type: "MESSAGE",
            severity: "INFO",
            title: message,
            message,
            timestamp: new Date().toISOString(),
            sdkName: "@halo/sdk",
            sdkVersion: "0.0.1",
        });

    }
}