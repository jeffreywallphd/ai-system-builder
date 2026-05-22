"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_AI_CONTEXT_QUALITY_STATUSES = void 0;
exports.isAssetAiContextQualityStatus = isAssetAiContextQualityStatus;
exports.normalizeAssetAiContextQualityStatus = normalizeAssetAiContextQualityStatus;
exports.ASSET_AI_CONTEXT_QUALITY_STATUSES = [
    "draft",
    "incomplete",
    "review-ready",
    "approved",
    "needs-revision",
];
function isAssetAiContextQualityStatus(value) {
    return exports.ASSET_AI_CONTEXT_QUALITY_STATUSES.includes(value);
}
function normalizeAssetAiContextQualityStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetAiContextQualityStatus(normalized)) {
        throw new Error("Asset AI-context quality status must be one of ".concat(exports.ASSET_AI_CONTEXT_QUALITY_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
