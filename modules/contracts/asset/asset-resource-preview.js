"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_RESOURCE_PREVIEW_KINDS = void 0;
exports.isAssetResourcePreviewKind = isAssetResourcePreviewKind;
exports.normalizeAssetResourcePreviewKind = normalizeAssetResourcePreviewKind;
exports.ASSET_RESOURCE_PREVIEW_KINDS = [
    "thumbnail",
    "text-summary",
    "metadata-summary",
    "table-sample",
    "image-preview",
    "document-preview",
    "model-card",
    "dataset-sample",
    "custom",
];
function isAssetResourcePreviewKind(value) {
    return exports.ASSET_RESOURCE_PREVIEW_KINDS.includes(value);
}
function normalizeAssetResourcePreviewKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetResourcePreviewKind(normalized)) {
        throw new Error("Asset resource preview kind must be one of ".concat(exports.ASSET_RESOURCE_PREVIEW_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
