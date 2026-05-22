"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_RESOURCE_KINDS = void 0;
exports.isAssetResourceKind = isAssetResourceKind;
exports.normalizeAssetResourceKind = normalizeAssetResourceKind;
exports.ASSET_RESOURCE_KINDS = [
    "artifact",
    "storage-object",
    "artifact-repository-object",
    "external-repository-object",
    "generated-output",
    "preview",
    "image",
    "dataset",
    "model",
    "document",
    "file",
    "url-reference",
    "custom",
];
function isAssetResourceKind(value) {
    return exports.ASSET_RESOURCE_KINDS.includes(value);
}
function normalizeAssetResourceKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetResourceKind(normalized)) {
        throw new Error("Asset resource kind must be one of ".concat(exports.ASSET_RESOURCE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
