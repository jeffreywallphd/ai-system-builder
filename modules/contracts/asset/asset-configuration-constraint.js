"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_CONFIGURATION_CONSTRAINT_KINDS = void 0;
exports.isAssetConfigurationConstraintKind = isAssetConfigurationConstraintKind;
exports.normalizeAssetConfigurationConstraintKind = normalizeAssetConfigurationConstraintKind;
exports.ASSET_CONFIGURATION_CONSTRAINT_KINDS = [
    "required",
    "min",
    "max",
    "min-length",
    "max-length",
    "pattern",
    "one-of",
    "asset-type",
    "asset-family",
    "runtime-capability",
    "resource-kind",
    "custom",
];
function isAssetConfigurationConstraintKind(value) {
    return exports.ASSET_CONFIGURATION_CONSTRAINT_KINDS.includes(value);
}
function normalizeAssetConfigurationConstraintKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetConfigurationConstraintKind(normalized)) {
        throw new Error("Asset configuration constraint kind must be one of ".concat(exports.ASSET_CONFIGURATION_CONSTRAINT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
