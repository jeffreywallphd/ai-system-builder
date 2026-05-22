"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAssetPackVersion = isAssetPackVersion;
exports.normalizeAssetPackVersion = normalizeAssetPackVersion;
var SEMVER_LIKE_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
function isAssetPackVersion(value) {
    return SEMVER_LIKE_PATTERN.test(value.trim());
}
function normalizeAssetPackVersion(value) {
    var normalized = value.trim();
    if (!isAssetPackVersion(normalized)) {
        throw new Error("Asset pack version must be semver-like. Received \"".concat(value, "\"."));
    }
    return normalized;
}
