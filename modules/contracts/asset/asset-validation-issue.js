"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_VALIDATION_ISSUE_CATEGORIES = exports.ASSET_VALIDATION_ISSUE_SEVERITIES = void 0;
exports.isAssetValidationIssueSeverity = isAssetValidationIssueSeverity;
exports.normalizeAssetValidationIssueSeverity = normalizeAssetValidationIssueSeverity;
exports.isAssetValidationIssueCategory = isAssetValidationIssueCategory;
exports.normalizeAssetValidationIssueCategory = normalizeAssetValidationIssueCategory;
exports.ASSET_VALIDATION_ISSUE_SEVERITIES = [
    "info",
    "warning",
    "error",
];
exports.ASSET_VALIDATION_ISSUE_CATEGORIES = [
    "identity",
    "lifecycle",
    "configuration",
    "ai-context",
    "binding",
    "composition",
    "requirement",
    "provenance",
    "security",
    "resource",
    "unknown",
];
function isAssetValidationIssueSeverity(value) {
    return exports.ASSET_VALIDATION_ISSUE_SEVERITIES.includes(value);
}
function normalizeAssetValidationIssueSeverity(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetValidationIssueSeverity(normalized)) {
        throw new Error("Asset validation issue severity must be one of ".concat(exports.ASSET_VALIDATION_ISSUE_SEVERITIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetValidationIssueCategory(value) {
    return exports.ASSET_VALIDATION_ISSUE_CATEGORIES.includes(value);
}
function normalizeAssetValidationIssueCategory(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetValidationIssueCategory(normalized)) {
        throw new Error("Asset validation issue category must be one of ".concat(exports.ASSET_VALIDATION_ISSUE_CATEGORIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
