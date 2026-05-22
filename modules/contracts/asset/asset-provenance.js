"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PROVENANCE_SOURCE_KINDS = void 0;
exports.isAssetProvenanceSourceKind = isAssetProvenanceSourceKind;
exports.normalizeAssetProvenanceSourceKind = normalizeAssetProvenanceSourceKind;
exports.ASSET_PROVENANCE_SOURCE_KINDS = [
    "human-authored",
    "ai-generated",
    "imported",
    "runtime-generated",
    "system-generated",
];
function isAssetProvenanceSourceKind(value) {
    return exports.ASSET_PROVENANCE_SOURCE_KINDS.includes(value);
}
function normalizeAssetProvenanceSourceKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetProvenanceSourceKind(normalized)) {
        throw new Error("Asset provenance source kind must be one of ".concat(exports.ASSET_PROVENANCE_SOURCE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
