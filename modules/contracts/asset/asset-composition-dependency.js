"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_COMPOSITION_DEPENDENCY_KINDS = void 0;
exports.isAssetCompositionDependencyKind = isAssetCompositionDependencyKind;
exports.normalizeAssetCompositionDependencyKind = normalizeAssetCompositionDependencyKind;
exports.ASSET_COMPOSITION_DEPENDENCY_KINDS = [
    "asset",
    "asset-type",
    "asset-family",
    "resource",
    "artifact",
    "runtime-capability",
    "external-repository-object",
    "configuration",
    "custom",
];
function isAssetCompositionDependencyKind(value) {
    return exports.ASSET_COMPOSITION_DEPENDENCY_KINDS.includes(value);
}
function normalizeAssetCompositionDependencyKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetCompositionDependencyKind(normalized)) {
        throw new Error("Asset composition dependency kind must be one of ".concat(exports.ASSET_COMPOSITION_DEPENDENCY_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
