"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_ID_FORMAT_DESCRIPTION = void 0;
exports.isAssetPackId = isAssetPackId;
exports.normalizeAssetPackId = normalizeAssetPackId;
exports.ASSET_PACK_ID_FORMAT_DESCRIPTION = "a stable, namespaced, non-empty manifest-safe string that is not a path, URL, provider locator, or file name";
var FILE_NAME_EXTENSIONS = /\.(?:json|ya?ml|toml|zip|tgz|tar|gz)$/i;
function invalidAssetPackIdMessage(packId) {
    return "Asset pack id must be ".concat(exports.ASSET_PACK_ID_FORMAT_DESCRIPTION, ". Received \"").concat(packId, "\".");
}
function looksLikeUnsafePathUrlOrFile(value) {
    return (value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../") ||
        /^[a-zA-Z]:[\\/]/.test(value) ||
        value.includes("\\") ||
        /^https?:\/\//i.test(value) ||
        /^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*(?:\/|$)/i.test(value) ||
        FILE_NAME_EXTENSIONS.test(value));
}
function isAssetPackId(packId) {
    var normalized = packId.trim();
    return (normalized.length > 0 &&
        normalized.includes(".") &&
        /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/.test(normalized) &&
        !looksLikeUnsafePathUrlOrFile(normalized));
}
function normalizeAssetPackId(packId) {
    var normalized = packId.trim();
    if (!isAssetPackId(normalized)) {
        throw new Error(invalidAssetPackIdMessage(packId));
    }
    return normalized;
}
