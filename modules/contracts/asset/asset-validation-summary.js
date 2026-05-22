"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_VALIDATION_SUMMARY_STATUSES = void 0;
exports.isAssetValidationSummaryStatus = isAssetValidationSummaryStatus;
exports.normalizeAssetValidationSummaryStatus = normalizeAssetValidationSummaryStatus;
exports.ASSET_VALIDATION_SUMMARY_STATUSES = [
    "not-validated",
    "valid",
    "valid-with-warnings",
    "invalid",
    "unknown",
];
function isAssetValidationSummaryStatus(value) {
    return exports.ASSET_VALIDATION_SUMMARY_STATUSES.includes(value);
}
function normalizeAssetValidationSummaryStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetValidationSummaryStatus(normalized)) {
        throw new Error("Asset validation summary status must be one of ".concat(exports.ASSET_VALIDATION_SUMMARY_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
