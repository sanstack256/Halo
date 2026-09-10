import { describe, it, expect } from "vitest";
import {
    prioritizeAttentionItems,
    summarizeAttention,
    AttentionItem,
} from "../attention-model";

describe("Canonical Attention Model", () => {
    it("prioritizes FATAL issues above ERROR issues and changes", () => {
        const items: AttentionItem[] = [
            {
                id: "item-1",
                type: "CHANGE",
                severity: "WARNING",
                title: "Release v1.2.0 suspicious",
                summary: "Correlated errors observed",
                source: "auth-service",
                timestamp: new Date("2026-09-10T10:00:00Z"),
                destination: "/dashboards/changes?projectId=p1",
                evidenceReference: { entityId: "rel-1", entityType: "release" },
                status: "Suspicious",
            },
            {
                id: "item-2",
                type: "ISSUE",
                severity: "ERROR",
                title: "Database connection timeout",
                summary: "12 occurrences observed",
                source: "db-service",
                timestamp: new Date("2026-09-10T11:00:00Z"),
                destination: "/projects/p1/issues/iss-1",
                evidenceReference: { entityId: "iss-1", entityType: "issue" },
                status: "OPEN",
            },
            {
                id: "item-3",
                type: "ISSUE",
                severity: "FATAL",
                title: "Payment gateway panic",
                summary: "1 occurrence observed",
                source: "payment-service",
                timestamp: new Date("2026-09-10T09:00:00Z"),
                destination: "/projects/p1/issues/iss-2",
                evidenceReference: { entityId: "iss-2", entityType: "issue" },
                status: "OPEN",
            },
        ];

        const prioritized = prioritizeAttentionItems(items);

        // FATAL first, then ERROR, then WARNING
        expect(prioritized[0].id).toBe("item-3");
        expect(prioritized[0].severity).toBe("FATAL");
        expect(prioritized[1].id).toBe("item-2");
        expect(prioritized[1].severity).toBe("ERROR");
        expect(prioritized[2].id).toBe("item-1");
        expect(prioritized[2].severity).toBe("WARNING");
    });

    it("prioritizes same-severity items by type priority (ISSUE > CHANGE > INVESTIGATION > TELEMETRY_GAP)", () => {
        const now = new Date("2026-09-10T12:00:00Z");
        const items: AttentionItem[] = [
            {
                id: "gap-1",
                type: "TELEMETRY_GAP",
                severity: "INFO",
                title: "Missing SDK",
                summary: "Install SDK",
                source: "Project A",
                timestamp: now,
                destination: "/projects/p1/sdk",
                evidenceReference: { entityId: "p1", entityType: "project" },
                status: "Pending Setup",
            },
            {
                id: "inv-1",
                type: "INVESTIGATION",
                severity: "INFO",
                title: "Investigation concluded",
                summary: "Root cause found",
                source: "Project A",
                timestamp: now,
                destination: "/investigate",
                evidenceReference: { entityId: "inv-1", entityType: "investigation" },
                status: "COMPLETED",
            },
        ];

        const prioritized = prioritizeAttentionItems(items);
        expect(prioritized[0].type).toBe("INVESTIGATION");
        expect(prioritized[1].type).toBe("TELEMETRY_GAP");
    });

    it("prioritizes same-severity and same-type items by recency", () => {
        const tOlder = new Date("2026-09-10T10:00:00Z");
        const tNewer = new Date("2026-09-10T11:00:00Z");

        const items: AttentionItem[] = [
            {
                id: "issue-old",
                type: "ISSUE",
                severity: "ERROR",
                title: "Older issue",
                summary: "Context",
                source: "svc-1",
                timestamp: tOlder,
                destination: "/projects/p1/issues/1",
                evidenceReference: { entityId: "1", entityType: "issue" },
                status: "OPEN",
            },
            {
                id: "issue-new",
                type: "ISSUE",
                severity: "ERROR",
                title: "Newer issue",
                summary: "Context",
                source: "svc-1",
                timestamp: tNewer,
                destination: "/projects/p1/issues/2",
                evidenceReference: { entityId: "2", entityType: "issue" },
                status: "OPEN",
            },
        ];

        const prioritized = prioritizeAttentionItems(items);
        expect(prioritized[0].id).toBe("issue-new");
        expect(prioritized[1].id).toBe("issue-old");
    });

    it("correctly summarizes attention counts", () => {
        const items: AttentionItem[] = [
            {
                id: "1",
                type: "ISSUE",
                severity: "FATAL",
                title: "Fatal",
                summary: "",
                source: "",
                timestamp: new Date(),
                destination: "",
                evidenceReference: { entityId: "1", entityType: "issue" },
                status: "",
            },
            {
                id: "2",
                type: "ISSUE",
                severity: "ERROR",
                title: "Error",
                summary: "",
                source: "",
                timestamp: new Date(),
                destination: "",
                evidenceReference: { entityId: "2", entityType: "issue" },
                status: "",
            },
            {
                id: "3",
                type: "CHANGE",
                severity: "WARNING",
                title: "Warning",
                summary: "",
                source: "",
                timestamp: new Date(),
                destination: "",
                evidenceReference: { entityId: "3", entityType: "release" },
                status: "",
            },
            {
                id: "4",
                type: "TELEMETRY_GAP",
                severity: "INFO",
                title: "Gap",
                summary: "",
                source: "",
                timestamp: new Date(),
                destination: "",
                evidenceReference: { entityId: "4", entityType: "project" },
                status: "",
            },
        ];

        const summary = summarizeAttention(items);
        expect(summary.totalItems).toBe(4);
        expect(summary.fatalCount).toBe(1);
        expect(summary.errorCount).toBe(1);
        expect(summary.warningCount).toBe(1);
        expect(summary.hasGaps).toBe(true);
    });

    it("truthfully summarizes an empty list without fake counts", () => {
        const summary = summarizeAttention([]);
        expect(summary.totalItems).toBe(0);
        expect(summary.fatalCount).toBe(0);
        expect(summary.errorCount).toBe(0);
        expect(summary.warningCount).toBe(0);
        expect(summary.hasGaps).toBe(false);
    });
});
