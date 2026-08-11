import type {
    Change,
    ChangeType,
} from "../types/change";
import type { Evidence } from "../types/evidence";

type ChangeEvidenceType = Extract<
    ChangeType,
    Evidence["type"]
>;

type ChangeEvidence = Evidence & {
    type: ChangeEvidenceType;
};

const CHANGE_TYPES =
    new Set<ChangeEvidenceType>([
        "DEPLOYMENT",
        "CONFIG",
        "FEATURE_FLAG",
        "INFRASTRUCTURE",
    ]);

function isChangeEvidence(
    evidence: Evidence,
): evidence is ChangeEvidence {
    return CHANGE_TYPES.has(
        evidence.type as ChangeEvidenceType,
    );
}

export function detectChanges(
    evidence: Evidence[],
): Change[] {
    return evidence
        .filter(isChangeEvidence)
        .map(evidence => ({
            id: evidence.id,
            type: evidence.type,
            title: evidence.title,
            description:
                evidence.description,
            timestamp:
                evidence.timestamp,
            evidenceIds: [
                evidence.id,
            ],
        }))
        .sort(
            (a, b) =>
                a.timestamp.getTime() -
                    b.timestamp.getTime() ||
                a.id.localeCompare(b.id),
        );
}