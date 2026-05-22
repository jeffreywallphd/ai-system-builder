"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PORT_CARDINALITY_PRESETS = void 0;
exports.isAssetPortCardinalityPreset = isAssetPortCardinalityPreset;
exports.normalizeAssetPortCardinalityPreset = normalizeAssetPortCardinalityPreset;
exports.ASSET_PORT_CARDINALITY_PRESETS = [
    "optional",
    "required",
    "zero-or-more",
    "one-or-more",
    "exactly-one",
];
function isAssetPortCardinalityPreset(value) {
    return exports.ASSET_PORT_CARDINALITY_PRESETS.includes(value);
}
function normalizeAssetPortCardinalityPreset(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPortCardinalityPreset(normalized)) {
        throw new Error("Asset port cardinality preset must be one of ".concat(exports.ASSET_PORT_CARDINALITY_PRESETS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
