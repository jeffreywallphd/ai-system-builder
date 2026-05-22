"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_FAMILIES = void 0;
exports.isAssetFamily = isAssetFamily;
exports.normalizeAssetFamily = normalizeAssetFamily;
exports.ASSET_FAMILIES = [
    "structural",
    "behavioral",
    "resource-backed",
    "context",
    "composition",
];
function isAssetFamily(value) {
    return exports.ASSET_FAMILIES.includes(value);
}
function normalizeAssetFamily(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetFamily(normalized)) {
        throw new Error("Asset family must be one of ".concat(exports.ASSET_FAMILIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
