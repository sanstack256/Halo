import type {
    Evidence,
} from "../types/evidence";

export function sameService(
    left: Evidence,
    right: Evidence
) {

    return left.service === right.service;

}