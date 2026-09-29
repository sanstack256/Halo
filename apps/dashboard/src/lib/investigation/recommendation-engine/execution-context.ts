/**
 * Halo Trace — Phase 7 Autonomous Proof Environment Execution Context & Provenance
 *
 * Implements Phase 7 Directives (§4, §5, §31, §34, §35, §44, §66, §67, §102):
 * 1. Complete ExecutionContext model with field-level provenance tracking.
 * 2. 4-Tier Provenance: OBSERVED, DERIVED, INFERRED, UNKNOWN.
 * 3. 7-State Environment Readiness: NOT_ATTEMPTED, DISCOVERING, READY, PARTIALLY_READY, BLOCKED, FAILED, STALE.
 * 4. 13-Point Environment Capability Matrix.
 * 5. 12-Class Environment Failure Classification (§35).
 * 6. 4-Class Final Scenario Classification (§102).
 * 7. Command Safety Classification (§44) and Environment Snapshot Hashing (§66).
 * 8. Proof Provenance with cryptographic link to environmentHash (§67).
 */

import crypto from "node:crypto";

/* -------------------------------------------------------------------------- */
/* 1. Execution Context Provenance (§4, §5)                                    */
/* -------------------------------------------------------------------------- */

export type ExecutionContextProvenance = "OBSERVED" | "DERIVED" | "INFERRED" | "UNKNOWN";

export interface ExecutionContextField<T> {
    value: T;
    source: string;
    confidence: ExecutionContextProvenance;
    observedAt: string;
    contentHash: string;
}

export function createExecutionContextField<T>(
    value: T,
    source: string,
    confidence: ExecutionContextProvenance
): ExecutionContextField<T> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const contentHash = crypto.createHash("sha256").update(serialized ?? "").digest("hex");
    return {
        value,
        source,
        confidence,
        observedAt: new Date().toISOString(),
        contentHash,
    };
}

/* -------------------------------------------------------------------------- */
/* 2. Environment Readiness States & Capability Matrix (§31, §34)              */
/* -------------------------------------------------------------------------- */

export type EnvironmentReadinessState =
    | "NOT_ATTEMPTED"
    | "DISCOVERING"
    | "READY"
    | "PARTIALLY_READY"
    | "BLOCKED"
    | "FAILED"
    | "STALE";

export interface EnvironmentCapabilityMatrix {
    source: boolean;
    manifest: boolean;
    lockfile: boolean;
    runtime: boolean;
    dependencies: boolean;
    testRunner: boolean;
    reproduction: boolean;
    database: boolean;
    externalMocks: boolean;
    configuration: boolean;
    build: boolean;
    targetedTest: boolean;
    regressionTest: boolean;
}

/* -------------------------------------------------------------------------- */
/* 3. Environment Failure Classification (§35, §102)                           */
/* -------------------------------------------------------------------------- */

export type EnvironmentFailureClassification =
    | "SOURCE_UNAVAILABLE"
    | "MANIFEST_UNAVAILABLE"
    | "RUNTIME_UNAVAILABLE"
    | "DEPENDENCY_UNAVAILABLE"
    | "TEST_RUNNER_UNAVAILABLE"
    | "REPRODUCTION_UNAVAILABLE"
    | "DATABASE_UNAVAILABLE"
    | "EXTERNAL_SERVICE_UNAVAILABLE"
    | "SECRET_UNAVAILABLE"
    | "CONFIGURATION_UNAVAILABLE"
    | "BUILD_ARTIFACT_UNAVAILABLE"
    | "UNSAFE_TO_EXECUTE";

export type EnvironmentReconstructionStatus =
    | "ENVIRONMENT_RECONSTRUCTED"
    | "ENVIRONMENT_RECONSTRUCTION_BLOCKED"
    | "ENVIRONMENT_RECONSTRUCTION_UNSAFE"
    | "ENVIRONMENT_RECONSTRUCTION_FAILED";

/* -------------------------------------------------------------------------- */
/* 4. Command Safety & Provenance (§44, §73)                                  */
/* -------------------------------------------------------------------------- */

export type CommandSafetyClass =
    | "READ_ONLY"
    | "LOCAL_BUILD"
    | "LOCAL_TEST"
    | "LOCAL_MUTATION"
    | "NETWORK"
    | "EXTERNAL_MUTATION"
    | "DESTRUCTIVE"
    | "UNKNOWN";

export interface ValidatedCommand {
    command: string;
    source: string;
    safetyClass: CommandSafetyClass;
    isAuthorized: boolean;
    workingDirectory: string;
    rejectionReason?: string;
}

export function classifyCommandSafety(cmd: string): CommandSafetyClass {
    const trimmed = cmd.trim().toLowerCase();
    
    // Unsafe / Destructive Patterns (§44, §70, §73)
    if (
        trimmed.includes("rm -rf /") ||
        trimmed.includes("rm -rf ~") ||
        trimmed.includes("dd if=") ||
        trimmed.includes("mkfs") ||
        trimmed.includes(":(){ :|:& };:") ||
        trimmed.includes("> /dev/sda")
    ) {
        return "DESTRUCTIVE";
    }

    // Network / Credential Access Patterns (§19, §21, §73)
    if (
        trimmed.includes("curl ") ||
        trimmed.includes("wget ") ||
        trimmed.includes("ssh ") ||
        trimmed.includes("scp ") ||
        trimmed.includes("nc -") ||
        trimmed.includes("aws ") ||
        trimmed.includes(".ssh/") ||
        trimmed.includes(".aws/")
    ) {
        return "NETWORK";
    }

    // Safe Test Patterns (§44)
    if (
        trimmed.startsWith("node --test") ||
        trimmed.startsWith("node test/") ||
        trimmed.startsWith("node ") && trimmed.includes(".test.") ||
        trimmed.startsWith("vitest") ||
        trimmed.startsWith("jest") ||
        trimmed.startsWith("pnpm test") ||
        trimmed.startsWith("npm test") ||
        trimmed.startsWith("cargo test") ||
        trimmed.startsWith("go test") ||
        trimmed.startsWith("pytest")
    ) {
        return "LOCAL_TEST";
    }

    // Local Build Patterns
    if (
        trimmed.startsWith("pnpm build") ||
        trimmed.startsWith("npm run build") ||
        trimmed.startsWith("cargo build") ||
        trimmed.startsWith("tsc")
    ) {
        return "LOCAL_BUILD";
    }

    // Read-only inspection
    if (
        trimmed.startsWith("node -c") ||
        trimmed.startsWith("node --check") ||
        trimmed.startsWith("cat ") ||
        trimmed.startsWith("git log") ||
        trimmed.startsWith("git diff")
    ) {
        return "READ_ONLY";
    }

    return "UNKNOWN";
}

/* -------------------------------------------------------------------------- */
/* 5. Complete ExecutionContext Model (§4)                                     */
/* -------------------------------------------------------------------------- */

export interface ExecutionContext {
    workspaceRoot: ExecutionContextField<string>;
    repositoryIdentity: ExecutionContextField<string>;
    revision: ExecutionContextField<string>;
    sourceFiles: ExecutionContextField<string[]>;
    testFiles: ExecutionContextField<string[]>;
    manifestFiles: ExecutionContextField<string[]>;
    lockfiles: ExecutionContextField<string[]>;
    workspaceConfiguration: ExecutionContextField<Record<string, unknown>>;
    runtimeVersion: ExecutionContextField<string>;
    packageManager: ExecutionContextField<string>;
    dependencyGraph: ExecutionContextField<Record<string, string>>;
    buildCommand?: ExecutionContextField<string>;
    testCommand?: ExecutionContextField<string>;
    reproductionCommand?: ExecutionContextField<string>;
    environmentRequirements: ExecutionContextField<string[]>;
    framework: ExecutionContextField<string>;
    language: ExecutionContextField<string>;
    compiler: ExecutionContextField<string>;
    runtime: ExecutionContextField<string>;
    generatedArtifacts: ExecutionContextField<string[]>;
    availableScripts: ExecutionContextField<string[]>;
    
    // Status and Proof Links
    readinessState: EnvironmentReadinessState;
    capabilityMatrix: EnvironmentCapabilityMatrix;
    environmentHash: string;
    reconstructionStatus: EnvironmentReconstructionStatus;
    blockingClassification?: EnvironmentFailureClassification;
    missingArtifactDetails?: string;
    executionId: string;
}

/* -------------------------------------------------------------------------- */
/* 6. Environment Snapshot Hashing (§66)                                       */
/* -------------------------------------------------------------------------- */

export function computeEnvironmentSnapshotHash(context: Partial<ExecutionContext>): string {
    const payload = {
        workspaceRoot: context.workspaceRoot?.value,
        repositoryIdentity: context.repositoryIdentity?.value,
        revision: context.revision?.value,
        sourceFiles: context.sourceFiles?.value?.slice().sort(),
        testFiles: context.testFiles?.value?.slice().sort(),
        manifestFiles: context.manifestFiles?.value?.slice().sort(),
        lockfiles: context.lockfiles?.value?.slice().sort(),
        runtimeVersion: context.runtimeVersion?.value,
        packageManager: context.packageManager?.value,
        dependencies: context.dependencyGraph?.value,
        testCommand: context.testCommand?.value,
        reproductionCommand: context.reproductionCommand?.value,
    };
    return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
