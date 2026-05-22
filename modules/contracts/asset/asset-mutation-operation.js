"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_MUTATION_OPERATIONS = void 0;
exports.isAssetMutationOperation = isAssetMutationOperation;
exports.assertAssetMutationOperation = assertAssetMutationOperation;
exports.ASSET_MUTATION_OPERATIONS = [
    "asset.register-resource-backed-view",
    "asset.finalize-generated-output",
    "asset.import-external-repository-object",
    "asset.localize-external-repository-object",
];
function isAssetMutationOperation(value) {
    return exports.ASSET_MUTATION_OPERATIONS.includes(value);
}
function assertAssetMutationOperation(value) {
    if (!isAssetMutationOperation(value)) {
        throw new Error("Asset mutation operation must be one of ".concat(exports.ASSET_MUTATION_OPERATIONS.join(", "), ". Received \"").concat(value, "\"."));
    }
}
