export type ImpactSeverity =
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

export interface Impact {
    affectedServices: string[];

    affectedUsers: number;

    affectedRegions: string[];

    severity: ImpactSeverity;
}