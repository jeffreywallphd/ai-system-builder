"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_CONFIGURATION_UI_HINT_KINDS = void 0;
exports.isAssetConfigurationUiHintKind = isAssetConfigurationUiHintKind;
exports.normalizeAssetConfigurationUiHintKind = normalizeAssetConfigurationUiHintKind;
exports.ASSET_CONFIGURATION_UI_HINT_KINDS = [
    "text",
    "textarea",
    "number",
    "checkbox",
    "select",
    "multi-select",
    "slider",
    "asset-picker",
    "resource-picker",
    "artifact-picker",
    "runtime-capability-picker",
    "json-editor",
    "hidden",
    "advanced",
];
function isAssetConfigurationUiHintKind(value) {
    return exports.ASSET_CONFIGURATION_UI_HINT_KINDS.includes(value);
}
function normalizeAssetConfigurationUiHintKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetConfigurationUiHintKind(normalized)) {
        throw new Error("Asset configuration UI hint kind must be one of ".concat(exports.ASSET_CONFIGURATION_UI_HINT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
