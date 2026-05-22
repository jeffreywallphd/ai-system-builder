"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_COMPOSITION_TYPES = void 0;
exports.isAssetCompositionType = isAssetCompositionType;
exports.normalizeAssetCompositionType = normalizeAssetCompositionType;
exports.ASSET_COMPOSITION_TYPES = [
    "feature",
    "workflow",
    "page",
    "subsystem",
    "system",
    "system-of-subsystems",
];
function isAssetCompositionType(value) {
    return exports.ASSET_COMPOSITION_TYPES.includes(value);
}
function normalizeAssetCompositionType(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetCompositionType(normalized)) {
        throw new Error("Asset composition type must be one of ".concat(exports.ASSET_COMPOSITION_TYPES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
