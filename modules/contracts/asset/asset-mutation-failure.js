"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_MUTATION_FAILURE_CODES = void 0;
exports.isAssetMutationFailureCode = isAssetMutationFailureCode;
exports.ASSET_MUTATION_FAILURE_CODES = [
    "validation",
    "approval-required",
    "permission",
    "not-found",
    "conflict",
    "unavailable",
    "partial-failure",
    "internal",
];
function isAssetMutationFailureCode(value) {
    return exports.ASSET_MUTATION_FAILURE_CODES.includes(value);
}
