"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_COMPOSITION_VALIDATION_STATUSES = void 0;
exports.isAssetCompositionValidationStatus = isAssetCompositionValidationStatus;
exports.normalizeAssetCompositionValidationStatus = normalizeAssetCompositionValidationStatus;
var asset_validation_summary_1 = require("./asset-validation-summary");
exports.ASSET_COMPOSITION_VALIDATION_STATUSES = asset_validation_summary_1.ASSET_VALIDATION_SUMMARY_STATUSES;
function isAssetCompositionValidationStatus(value) {
    return (0, asset_validation_summary_1.isAssetValidationSummaryStatus)(value);
}
function normalizeAssetCompositionValidationStatus(value) {
    return (0, asset_validation_summary_1.normalizeAssetValidationSummaryStatus)(value);
}
