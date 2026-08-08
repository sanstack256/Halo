export interface Impact {
    affectedServices: string[];

    affectedUsers: number;

    affectedRegions: string[];

    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}