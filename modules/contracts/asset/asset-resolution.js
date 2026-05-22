"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_RESOLUTION_DIAGNOSTIC_SEVERITIES = exports.ASSET_RESOLUTION_MODES = void 0;
exports.isAssetResolutionMode = isAssetResolutionMode;
exports.normalizeAssetResolutionMode = normalizeAssetResolutionMode;
exports.isAssetResolutionDiagnosticSeverity = isAssetResolutionDiagnosticSeverity;
exports.normalizeAssetResolutionDiagnosticSeverity = normalizeAssetResolutionDiagnosticSeverity;
exports.ASSET_RESOLUTION_MODES = [
    "exact",
    "semantic",
    "compatible",
    "latest-active",
];
exports.ASSET_RESOLUTION_DIAGNOSTIC_SEVERITIES = [
    "info",
    "warning",
    "error",
];
function isAssetResolutionMode(value) {
    return exports.ASSET_RESOLUTION_MODES.includes(value);
}
function normalizeAssetResolutionMode(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetResolutionMode(normalized)) {
        throw new Error("Asset resolution mode must be one of ".concat(exports.ASSET_RESOLUTION_MODES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetResolutionDiagnosticSeverity(value) {
    return exports.ASSET_RESOLUTION_DIAGNOSTIC_SEVERITIES.includes(value);
}
function normalizeAssetResolutionDiagnosticSeverity(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetResolutionDiagnosticSeverity(normalized)) {
        throw new Error("Asset resolution diagnostic severity must be one of ".concat(exports.ASSET_RESOLUTION_DIAGNOSTIC_SEVERITIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
