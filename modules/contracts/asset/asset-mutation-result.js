"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_MUTATION_RESULT_STATUSES = void 0;
exports.createAssetMutationUnavailableResult = createAssetMutationUnavailableResult;
exports.ASSET_MUTATION_RESULT_STATUSES = [
    "created",
    "existing",
    "skipped",
    "pending",
    "partial",
];
function createAssetMutationUnavailableResult(operation, message) {
    if (message === void 0) { message = "Asset mutation behavior is not implemented yet."; }
    return {
        ok: false,
        operation: operation,
        failure: {
            code: "unavailable",
            message: message,
            operation: operation,
        },
    };
}
