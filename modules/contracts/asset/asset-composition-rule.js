"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_COMPOSITION_RULE_KINDS = void 0;
exports.isAssetCompositionRuleKind = isAssetCompositionRuleKind;
exports.normalizeAssetCompositionRuleKind = normalizeAssetCompositionRuleKind;
exports.ASSET_COMPOSITION_RULE_KINDS = [
    "allowed-parent",
    "allowed-child",
    "required-child",
    "optional-child",
    "incompatible-child",
    "required-dependency",
    "cardinality",
    "ordering",
    "binding-required",
    "runtime-requirement",
    "custom",
];
function isAssetCompositionRuleKind(value) {
    return exports.ASSET_COMPOSITION_RULE_KINDS.includes(value);
}
function normalizeAssetCompositionRuleKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetCompositionRuleKind(normalized)) {
        throw new Error("Asset composition rule kind must be one of ".concat(exports.ASSET_COMPOSITION_RULE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
