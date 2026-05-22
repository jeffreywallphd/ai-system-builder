"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_REFERENCE_KINDS = void 0;
exports.isAssetReferenceKind = isAssetReferenceKind;
exports.normalizeAssetReferenceKind = normalizeAssetReferenceKind;
exports.ASSET_REFERENCE_KINDS = [
    "asset-definition",
    "asset-definition-version",
    "asset-instance",
    "asset-composition",
    "asset-binding",
    "asset-requirement",
    "resource-backed-asset",
    "asset-resource-backing",
    "artifact",
    "resource",
    "external-repository-object",
];
function isAssetReferenceKind(value) {
    return exports.ASSET_REFERENCE_KINDS.includes(value);
}
function normalizeAssetReferenceKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetReferenceKind(normalized)) {
        throw new Error("Asset reference kind must be one of ".concat(exports.ASSET_REFERENCE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
