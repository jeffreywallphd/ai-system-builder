"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_ID_FORMAT_DESCRIPTION = void 0;
exports.isAssetId = isAssetId;
exports.normalizeAssetId = normalizeAssetId;
exports.ASSET_ID_FORMAT_DESCRIPTION = "a non-empty, trimmed, transport-neutral string that is not a filesystem path or provider-native locator";
function invalidAssetIdMessage(assetId) {
    return "Asset id must be ".concat(exports.ASSET_ID_FORMAT_DESCRIPTION, ". Received \"").concat(assetId, "\".");
}
function looksLikeUnsafePathOrLocator(value) {
    return (value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../") ||
        /^[a-zA-Z]:[\\/]/.test(value) ||
        value.includes("\\") ||
        /^https?:\/\//i.test(value) ||
        /^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*(?:\/|$)/i.test(value));
}
function isAssetId(assetId) {
    return assetId.trim().length > 0 && !looksLikeUnsafePathOrLocator(assetId.trim());
}
function normalizeAssetId(assetId) {
    var normalizedAssetId = assetId.trim();
    if (!isAssetId(normalizedAssetId)) {
        throw new Error(invalidAssetIdMessage(assetId));
    }
    return normalizedAssetId;
}
