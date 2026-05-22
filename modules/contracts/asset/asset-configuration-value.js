"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_CONFIGURATION_VALUE_KINDS = void 0;
exports.isAssetConfigurationValueKind = isAssetConfigurationValueKind;
exports.normalizeAssetConfigurationValueKind = normalizeAssetConfigurationValueKind;
exports.ASSET_CONFIGURATION_VALUE_KINDS = [
    "string",
    "number",
    "integer",
    "boolean",
    "enum",
    "array",
    "object",
    "asset-reference",
    "resource-reference",
    "artifact-reference",
    "runtime-capability-reference",
    "json",
];
function isAssetConfigurationValueKind(value) {
    return exports.ASSET_CONFIGURATION_VALUE_KINDS.includes(value);
}
function normalizeAssetConfigurationValueKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetConfigurationValueKind(normalized)) {
        throw new Error("Asset configuration value kind must be one of ".concat(exports.ASSET_CONFIGURATION_VALUE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
