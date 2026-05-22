"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAssetVersion = isAssetVersion;
exports.normalizeAssetVersion = normalizeAssetVersion;
function isAssetVersion(value) {
    return value.trim().length > 0;
}
function normalizeAssetVersion(value) {
    var normalized = value.trim();
    if (!isAssetVersion(normalized)) {
        throw new Error("Asset version must be a non-empty string. Received \"".concat(value, "\"."));
    }
    return normalized;
}
