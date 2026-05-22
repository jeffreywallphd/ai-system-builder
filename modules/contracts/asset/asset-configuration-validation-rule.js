"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_CONFIGURATION_VALIDATION_RULE_KINDS = void 0;
exports.isAssetConfigurationValidationRuleKind = isAssetConfigurationValidationRuleKind;
exports.normalizeAssetConfigurationValidationRuleKind = normalizeAssetConfigurationValidationRuleKind;
exports.ASSET_CONFIGURATION_VALIDATION_RULE_KINDS = [
    "field-required",
    "field-kind",
    "field-constraint",
    "cross-field",
    "composition-context",
    "resource-reference",
    "runtime-requirement",
    "custom",
];
function isAssetConfigurationValidationRuleKind(value) {
    return exports.ASSET_CONFIGURATION_VALIDATION_RULE_KINDS.includes(value);
}
function normalizeAssetConfigurationValidationRuleKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetConfigurationValidationRuleKind(normalized)) {
        throw new Error("Asset configuration validation rule kind must be one of ".concat(exports.ASSET_CONFIGURATION_VALIDATION_RULE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
