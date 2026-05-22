"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_LIFECYCLE_STATUSES = void 0;
exports.isAssetLifecycleStatus = isAssetLifecycleStatus;
exports.normalizeAssetLifecycleStatus = normalizeAssetLifecycleStatus;
exports.ASSET_LIFECYCLE_STATUSES = [
    "draft",
    "validated",
    "published",
    "deprecated",
    "archived",
    "failed-validation",
];
function isAssetLifecycleStatus(value) {
    return exports.ASSET_LIFECYCLE_STATUSES.includes(value);
}
function normalizeAssetLifecycleStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetLifecycleStatus(normalized)) {
        throw new Error("Asset lifecycle status must be one of ".concat(exports.ASSET_LIFECYCLE_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
