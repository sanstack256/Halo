import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

import { deploymentBeforeError } from "./deployment-before-error";
import { multipleErrors } from "./multiple-errors";
import { sameService } from "./same-service";
import { timeWindow } from "./time-window";
import { differentService } from "./different-service";
import { sharedDependency } from "./shared-dependency";
import { recovery } from "./recovery";
import { preExistingError } from "./pre-existing-error";
import { crossService } from "./cross-service";

export type InvestigationRule = (
    context: InvestigationContext
) => Finding[];

export const rules: InvestigationRule[] = [
    deploymentBeforeError,
    preExistingError,
    multipleErrors,
    sameService,
    timeWindow,
    differentService,
    sharedDependency,
    recovery,
    crossService,
];