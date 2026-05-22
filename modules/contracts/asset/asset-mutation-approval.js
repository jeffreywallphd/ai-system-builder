"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_MUTATION_CONFIRMATION_KINDS = void 0;
exports.isAssetMutationConfirmationKind = isAssetMutationConfirmationKind;
exports.ASSET_MUTATION_CONFIRMATION_KINDS = [
    "register-resource-backed-view",
    "finalize-generated-output",
    "import-external-object",
    "localize-external-object",
    "lifecycle-transition",
];
function isAssetMutationConfirmationKind(value) {
    return exports.ASSET_MUTATION_CONFIRMATION_KINDS.includes(value);
}
