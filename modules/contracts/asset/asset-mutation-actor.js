"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_MUTATION_INITIATORS = void 0;
exports.isAssetMutationInitiator = isAssetMutationInitiator;
exports.ASSET_MUTATION_INITIATORS = [
    "human",
    "ai-assisted",
    "system",
];
function isAssetMutationInitiator(value) {
    return exports.ASSET_MUTATION_INITIATORS.includes(value);
}
