"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_AI_CONTEXT_SAFETY_NOTE_SEVERITIES = exports.ASSET_AI_CONTEXT_SAFETY_NOTE_CATEGORIES = void 0;
exports.isAssetAiContextSafetyNoteCategory = isAssetAiContextSafetyNoteCategory;
exports.normalizeAssetAiContextSafetyNoteCategory = normalizeAssetAiContextSafetyNoteCategory;
exports.isAssetAiContextSafetyNoteSeverity = isAssetAiContextSafetyNoteSeverity;
exports.normalizeAssetAiContextSafetyNoteSeverity = normalizeAssetAiContextSafetyNoteSeverity;
exports.ASSET_AI_CONTEXT_SAFETY_NOTE_CATEGORIES = [
    "data-sensitivity",
    "filesystem-access",
    "network-access",
    "secret-access",
    "runtime-execution",
    "external-provider",
    "thin-client",
    "automation",
    "user-approval",
    "security",
    "privacy",
    "operational",
    "unknown",
];
exports.ASSET_AI_CONTEXT_SAFETY_NOTE_SEVERITIES = [
    "info",
    "warning",
    "critical",
];
function isAssetAiContextSafetyNoteCategory(value) {
    return exports.ASSET_AI_CONTEXT_SAFETY_NOTE_CATEGORIES.includes(value);
}
function normalizeAssetAiContextSafetyNoteCategory(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetAiContextSafetyNoteCategory(normalized)) {
        throw new Error("Asset AI-context safety note category must be one of ".concat(exports.ASSET_AI_CONTEXT_SAFETY_NOTE_CATEGORIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetAiContextSafetyNoteSeverity(value) {
    return exports.ASSET_AI_CONTEXT_SAFETY_NOTE_SEVERITIES.includes(value);
}
function normalizeAssetAiContextSafetyNoteSeverity(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetAiContextSafetyNoteSeverity(normalized)) {
        throw new Error("Asset AI-context safety note severity must be one of ".concat(exports.ASSET_AI_CONTEXT_SAFETY_NOTE_SEVERITIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
