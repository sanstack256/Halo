/**
 * Halo Trace — Unseen 2,000-Scenario Reliability Benchmark Corpus
 *
 * Generates an open-world corpus of 2,000 diverse incident scenarios across
 * diverse architectures, bug classes, call-chain depths, and boundary conditions.
 *
 * Ground truth metadata is kept strictly separated in hiddenTruth, never
 * passed to production engine functions.
 */

import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type { InvestigationSnapshot } from "../../types";
import type { HiddenScenarioTruth } from "./decomposed-benchmark-evaluator";

export interface BenchmarkScenarioItem {
    id: string;
    snapshot: InvestigationSnapshot;
    hiddenTruth: HiddenScenarioTruth;
}

const DOMAINS = [
    "billing", "auth", "inventory", "checkout", "shipping", "analytics",
    "notification", "search", "recommendation", "payment", "warehouse", "identity",
    "subscription", "catalog", "order", "fulfillment", "pricing", "customer"
];

const MODULE_NAMES = [
    "processor", "handler", "manager", "client", "controller", "service",
    "adapter", "gateway", "validator", "pipeline", "coordinator", "dispatcher"
];

export function buildUnseenBenchmarkCorpus(count: number = 2000): BenchmarkScenarioItem[] {
    const corpus: BenchmarkScenarioItem[] = [];

    for (let i = 1; i <= count; i++) {
        const domain = DOMAINS[i % DOMAINS.length];
        const moduleName = MODULE_NAMES[(i * 3) % MODULE_NAMES.length];
        const service = `${domain}-${moduleName}-svc`;
        const archetypeIndex = i % 10;
        const id = `BENCHMARK_SCENARIO_${String(i).padStart(4, "0")}`;

        let item: BenchmarkScenarioItem;

        switch (archetypeIndex) {
            case 0: {
                // 1. Logic Defect: Null dereference on optional nested property
                const fileName = `src/${domain}/${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `TypeError: Cannot read properties of undefined (reading 'flags')`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 5,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `TypeError: Cannot read properties of undefined (reading 'flags')`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "TypeError",
                                    message: "Cannot read properties of undefined (reading 'flags')",
                                    stack: `TypeError: Cannot read properties of undefined (reading 'flags')\n    at process${moduleName} (${fileName}:4:28)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 4,
                            containingFunction: `process${moduleName}`,
                            failingExpression: "record.metadata.flags",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function process${moduleName}(record: any) {` },
                                { lineNumber: 2, content: `    if (!record || typeof record !== "object") return null;` },
                                { lineNumber: 3, content: `    // Extract metadata flags` },
                                { lineNumber: 4, content: `    return record.metadata.flags.priority;` },
                                { lineNumber: 5, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "precondition",
                        expectedDefectCategory: "NULL_DEREFERENCE",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 1: {
                // 2. Caller Contract Violation: Missing required param
                const callerFile = `src/${domain}/caller_${moduleName}.ts`;
                const calleeFile = `src/${domain}/callee_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `Error: Missing required parameter 'tenantId'`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 7,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `Error: Missing required parameter 'tenantId'`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "Error",
                                    message: "Missing required parameter 'tenantId'",
                                    stack: `Error: Missing required parameter 'tenantId'\n    at requireTenant (${calleeFile}:3:15)\n    at dispatch${moduleName} (${callerFile}:12:5)`,
                                },
                            },
                        ],
                        stackFrames: [
                            {
                                order: 1,
                                rawFilePath: calleeFile,
                                filePath: calleeFile,
                                lineNumber: 3,
                                functionName: "requireTenant",
                                isInternal: false,
                                isApplication: true,
                                classification: "Application",
                            },
                            {
                                order: 2,
                                rawFilePath: callerFile,
                                filePath: callerFile,
                                lineNumber: 12,
                                functionName: `dispatch${moduleName}`,
                                isInternal: false,
                                isApplication: true,
                                classification: "Application",
                            },
                        ],
                        source: {
                            filePath: calleeFile,
                            failingLineNumber: 3,
                            containingFunction: "requireTenant",
                            failingExpression: "requireTenant(context)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function requireTenant(context: { tenantId?: string }) {` },
                                { lineNumber: 2, content: `    if (!context || !context.tenantId) {` },
                                { lineNumber: 3, content: `        throw new Error("Missing required parameter 'tenantId'");` },
                                { lineNumber: 4, content: `    }` },
                                { lineNumber: 5, content: `}` },
                            ],
                            callers: [callerFile],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: calleeFile,
                        expectedMechanismFile: callerFile,
                        expectedRepairFile: callerFile,
                        expectedRepairBoundaryType: "CALLER",
                        expectedInvariantClassification: "api_contract",
                        expectedDefectCategory: "CALLER_CONTRACT_VIOLATION",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 2: {
                // 3. Serialization defect: Unhandled JSON parse error
                const fileName = `src/${domain}/parser_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 9,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "SyntaxError",
                                    message: 'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON',
                                    stack: `SyntaxError: Unexpected token '<'\n    at parseIncoming (${fileName}:3:23)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 3,
                            containingFunction: "parseIncoming",
                            failingExpression: "JSON.parse(rawBody)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function parseIncoming(rawBody: string) {` },
                                { lineNumber: 2, content: `    // Parse JSON body` },
                                { lineNumber: 3, content: `    const data = JSON.parse(rawBody);` },
                                { lineNumber: 4, content: `    return data.id;` },
                                { lineNumber: 5, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "data_invariant",
                        expectedDefectCategory: "SERIALIZATION_DEFECT",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 3: {
                // 4. State Machine Invalid Transition
                const fileName = `src/${domain}/state_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `IllegalStateError: Cannot transition from CANCELLED to COMPLETED`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 3,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `IllegalStateError: Cannot transition from CANCELLED to COMPLETED`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "IllegalStateError",
                                    message: "Cannot transition from CANCELLED to COMPLETED",
                                    stack: `IllegalStateError: Cannot transition from CANCELLED to COMPLETED\n    at updateStatus (${fileName}:5:19)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 5,
                            containingFunction: "updateStatus",
                            failingExpression: "this.transition(nextState)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export class ${moduleName}StateMachine {` },
                                { lineNumber: 2, content: `    private state: string = "PENDING";` },
                                { lineNumber: 3, content: `    updateStatus(nextState: string) {` },
                                { lineNumber: 4, content: `        // Mutate state directly` },
                                { lineNumber: 5, content: `        this.transition(nextState);` },
                                { lineNumber: 6, content: `        return this.state;` },
                                { lineNumber: 7, content: `    }` },
                                { lineNumber: 8, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "lifecycle_invariant",
                        expectedDefectCategory: "STATE_MACHINE_TRANSITION",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 4: {
                // 5. Connection pool resource leak
                const fileName = `src/${domain}/db_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `TimeoutError: Connection pool exhausted (max: 20)`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 12,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `TimeoutError: Connection pool exhausted (max: 20)`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "TimeoutError",
                                    message: "Connection pool exhausted (max: 20)",
                                    stack: `TimeoutError: Connection pool exhausted\n    at acquireConnection (${fileName}:6:25)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 6,
                            containingFunction: "executeQuery",
                            failingExpression: "pool.acquire()",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export async function executeQuery(pool: any, sql: string) {` },
                                { lineNumber: 2, content: `    const client = await pool.connect();` },
                                { lineNumber: 3, content: `    try {` },
                                { lineNumber: 4, content: `        return await client.query(sql);` },
                                { lineNumber: 5, content: `    } catch (err) {` },
                                { lineNumber: 6, content: `        throw err;` },
                                { lineNumber: 7, content: `    }` },
                                { lineNumber: 8, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "resource_invariant",
                        expectedDefectCategory: "RESOURCE_LEAK",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 5: {
                // 6. External Third-Party Outage (No Code Change)
                const fileName = `src/${domain}/client_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `ExternalServiceError: 503 Service Unavailable (Stripe API Outage)`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 30,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `ExternalServiceError: 503 Service Unavailable (Stripe API Outage)`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "ExternalServiceError",
                                    message: "503 Service Unavailable (Stripe API Outage)",
                                    statusCode: "503",
                                    provider: "stripe",
                                    stack: `ExternalServiceError: 503 Service Unavailable\n    at callStripe (${fileName}:4:15)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 4,
                            containingFunction: "callStripe",
                            failingExpression: "stripeClient.charge()",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export async function callStripe(chargeParams: any) {` },
                                { lineNumber: 2, content: `    // Invoking external Stripe API` },
                                { lineNumber: 3, content: `    return await stripeClient.charge(chargeParams);` },
                                { lineNumber: 4, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "NO_CODE_CHANGE",
                        expectedInvariantClassification: "external_service_assumption",
                        expectedDefectCategory: "EXTERNAL_OUTAGE",
                        shouldModifyCode: false,
                        isExternalOutage: true,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 6: {
                // 7. Collection boundary error: reduce of empty array with no initial value
                const fileName = `src/${domain}/aggregator_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `TypeError: Reduce of empty array with no initial value`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 6,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `TypeError: Reduce of empty array with no initial value`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "TypeError",
                                    message: "Reduce of empty array with no initial value",
                                    stack: `TypeError: Reduce of empty array with no initial value\n    at sumScores (${fileName}:3:22)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 3,
                            containingFunction: "sumScores",
                            failingExpression: "scores.reduce((a, b) => a + b)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function sumScores(scores: number[]) {` },
                                { lineNumber: 2, content: `    // Compute sum` },
                                { lineNumber: 3, content: `    return scores.reduce((a, b) => a + b);` },
                                { lineNumber: 4, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "data_invariant",
                        expectedDefectCategory: "COLLECTION_BOUNDARY",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 7: {
                // 8. Missing Environment Configuration
                const fileName = `src/${domain}/config_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `ConfigError: Missing required environment variable 'DATABASE_URL'`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 4,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `ConfigError: Missing required environment variable 'DATABASE_URL'`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "ConfigError",
                                    message: "Missing required environment variable 'DATABASE_URL'",
                                    stack: `ConfigError: Missing required environment variable 'DATABASE_URL'\n    at getDbConfig (${fileName}:4:15)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 4,
                            containingFunction: "getDbConfig",
                            failingExpression: "process.env.DATABASE_URL",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function getDbConfig() {` },
                                { lineNumber: 2, content: `    const url = process.env.DATABASE_URL;` },
                                { lineNumber: 3, content: `    if (!url) {` },
                                { lineNumber: 4, content: `        throw new Error("Missing required environment variable 'DATABASE_URL'");` },
                                { lineNumber: 5, content: `    }` },
                                { lineNumber: 6, content: `    return { url };` },
                                { lineNumber: 7, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CONFIGURATION",
                        expectedInvariantClassification: "configuration_invariant",
                        expectedDefectCategory: "CONFIGURATION_ENV_MISSING",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }

            case 8: {
                // 9. Deployment Rollback Superior (commit introduced breaking schema change across multiple callers)
                const fileName = `src/${domain}/schema_${moduleName}.ts`;
                const shortSha = `a1b2c${(i * 7) % 900 + 100}`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `SchemaViolationError: Incompatible column format after release`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 25,
                            environment: "production",
                            service,
                            release: `v2.4.${i % 20}`,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `SchemaViolationError: Incompatible column format after release`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "SchemaViolationError",
                                    message: "Incompatible column format after release",
                                    stack: `SchemaViolationError: Incompatible column format\n    at validateSchema (${fileName}:3:15)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 3,
                            containingFunction: "validateSchema",
                            failingExpression: "schema.validate(payload)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export function validateSchema(payload: any) {` },
                                { lineNumber: 2, content: `    // Validates column contract` },
                                { lineNumber: 3, content: `    return schema.validate(payload);` },
                                { lineNumber: 4, content: `}` },
                            ],
                        },
                        release: {
                            deployedRelease: `v2.4.${i % 20}`,
                            causallyProvenCandidate: {
                                commitSha: `${shortSha}00000000000000000000000000000000`,
                                shortSha,
                                fullSha: `${shortSha}00000000000000000000000000000000`,
                                author: "engineer@company.com",
                                message: `Refactor schema to v2 format breaking v1 clients`,
                                commitDate: new Date("2026-09-18T09:55:00Z"),
                                committedAt: new Date("2026-09-18T09:55:00Z"),
                                changedFiles: [fileName, `src/${domain}/client.ts`],
                                filesChanged: [fileName, `src/${domain}/client.ts`],
                                temporalAssociation: "PRE_INCIDENT_IMMEDIATE",
                                sourceAssociation: "FAILING_FILE",
                                executionRelevance: "DEFINITIVE_ON_PATH",
                                behavioralRelevance: "ALTERS_OBSERVED_BEHAVIOR",
                                mechanismRelevance: "DIRECTLY_EXPLAINS_MECHANISM",
                                causalSupport: "CAUSALLY_PROVEN",
                                classification: "CONFIRMED_REGRESSION",
                                modifiesFailingFile: true,
                                modifiesFailingSymbol: true,
                                directlyModifiesFailingLine: true,
                                diffSnippet: "- function validateSchema\n+ // broken format",
                                rollbackAudit: {
                                    behaviorIntroducedProven: true,
                                    rollbackRemovesBehavior: true,
                                    previousRevisionHealthy: true,
                                    touchesOnlyFailingFile: false,
                                    unrelatedChangesBlastRadius: "MINIMAL",
                                    invariantRestored: true,
                                    reintroducesKnownDefect: false,
                                    safeForDeploymentState: true,
                                    targetedRepairSmallerBlastRadius: false,
                                    behaviorallyValidated: true,
                                    auditPassed: true,
                                    isCleanRollback: true,
                                    hasSubsequentDependentCommits: false,
                                    touchesExternalDatastores: false,
                                    isSchemaMigration: false,
                                    blastRadius: "CONTAINED_SERVICE",
                                },
                            },
                            candidates: [],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "DEPLOYMENT",
                        expectedInvariantClassification: "deployment_invariant",
                        expectedDefectCategory: "DEPLOYMENT_ROLLBACK_SUPERIOR",
                        shouldModifyCode: false,
                        isExternalOutage: false,
                        hasRollbackSuperiority: true,
                    },
                };
                break;
            }

            case 9:
            default: {
                // 10. Async race condition in shared state mutex
                const fileName = `src/${domain}/mutex_${moduleName}.ts`;
                item = {
                    id,
                    snapshot: buildInvestigationSnapshot({
                        incident: {
                            issueId: `inc-${id}`,
                            title: `ConcurrentModificationError: Mutex unlocked while task was active`,
                            firstSeen: new Date("2026-09-18T10:00:00Z"),
                            lastSeen: new Date("2026-09-18T10:05:00Z"),
                            eventCount: 8,
                            environment: "production",
                            service,
                        },
                        rawEvidence: [
                            {
                                id: `ev-${id}`,
                                type: "ERROR",
                                title: `ConcurrentModificationError: Mutex unlocked while task was active`,
                                timestamp: "2026-09-18T10:00:00Z",
                                service,
                                environment: "production",
                                tags: {
                                    exceptionType: "ConcurrentModificationError",
                                    message: "Mutex unlocked while task was active",
                                    stack: `ConcurrentModificationError: Mutex unlocked\n    at releaseLock (${fileName}:6:15)`,
                                },
                            },
                        ],
                        source: {
                            filePath: fileName,
                            failingLineNumber: 6,
                            containingFunction: "acquireAndRun",
                            failingExpression: "mutex.release()",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: `export async function acquireAndRun(mutex: any, task: () => Promise<void>) {` },
                                { lineNumber: 2, content: `    await mutex.acquire();` },
                                { lineNumber: 3, content: `    try {` },
                                { lineNumber: 4, content: `        await task();` },
                                { lineNumber: 5, content: `    } finally {` },
                                { lineNumber: 6, content: `        mutex.release();` },
                                { lineNumber: 7, content: `    }` },
                                { lineNumber: 8, content: `}` },
                            ],
                        },
                    }),
                    hiddenTruth: {
                        scenarioId: id,
                        expectedObservationFile: fileName,
                        expectedMechanismFile: fileName,
                        expectedRepairFile: fileName,
                        expectedRepairBoundaryType: "CALLEE",
                        expectedInvariantClassification: "concurrency_invariant",
                        expectedDefectCategory: "ASYNC_RACE",
                        shouldModifyCode: true,
                        isExternalOutage: false,
                        hasRollbackSuperiority: false,
                    },
                };
                break;
            }
        }

        corpus.push(item);
    }

    return corpus;
}
