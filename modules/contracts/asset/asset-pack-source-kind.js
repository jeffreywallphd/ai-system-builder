"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_SOURCE_KINDS = void 0;
exports.isAssetPackSourceKind = isAssetPackSourceKind;
exports.normalizeAssetPackSourceKind = normalizeAssetPackSourceKind;
exports.ASSET_PACK_SOURCE_KINDS = [
    "system",
    "workspace",
    "organization",
    "user",
    "imported",
    "community",
    "external",
];
function isAssetPackSourceKind(value) {
    return exports.ASSET_PACK_SOURCE_KINDS.includes(value);
}
function normalizeAssetPackSourceKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackSourceKind(normalized)) {
        throw new Error("Asset pack source kind must be one of ".concat(exports.ASSET_PACK_SOURCE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
