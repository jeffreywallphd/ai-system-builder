"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_REVIEW_STATUSES = void 0;
exports.isAssetReviewStatus = isAssetReviewStatus;
exports.normalizeAssetReviewStatus = normalizeAssetReviewStatus;
exports.ASSET_REVIEW_STATUSES = [
    "unreviewed",
    "reviewed",
    "approved",
    "rejected",
];
function isAssetReviewStatus(value) {
    return exports.ASSET_REVIEW_STATUSES.includes(value);
}
function normalizeAssetReviewStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetReviewStatus(normalized)) {
        throw new Error("Asset review status must be one of ".concat(exports.ASSET_REVIEW_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
