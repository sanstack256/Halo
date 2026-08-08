import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

import { differentService } from "./different-service";
import { deploymentBeforeError } from "./deployment-before-error";
import { timeWindow } from "./time-window";
import { multipleErrors } from "./multiple-errors";
import { sameService } from "./same-service";

export type InvestigationRule = (
    evidence: Evidence[]
) => RuleResult[];

export const rules: InvestigationRule[] = [
    deploymentBeforeError,
    multipleErrors,
    sameService,
    timeWindow,
    differentService,
];