"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_BINDING_CONSTRAINT_KINDS = void 0;
exports.isAssetBindingConstraintKind = isAssetBindingConstraintKind;
exports.normalizeAssetBindingConstraintKind = normalizeAssetBindingConstraintKind;
exports.ASSET_BINDING_CONSTRAINT_KINDS = [
    "required",
    "same-contract-kind",
    "same-data-kind",
    "asset-type",
    "asset-family",
    "resource-kind",
    "runtime-capability",
    "single-source",
    "single-target",
    "ordering",
    "custom",
];
function isAssetBindingConstraintKind(value) {
    return exports.ASSET_BINDING_CONSTRAINT_KINDS.includes(value);
}
function normalizeAssetBindingConstraintKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetBindingConstraintKind(normalized)) {
        throw new Error("Asset binding constraint kind must be one of ".concat(exports.ASSET_BINDING_CONSTRAINT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
