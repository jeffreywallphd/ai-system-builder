"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_REQUIREMENT_SAFETY_STATUSES = exports.ASSET_REQUIREMENT_PERMISSION_KINDS = exports.ASSET_REQUIREMENT_HOST_KINDS = exports.ASSET_REQUIREMENT_KINDS = void 0;
exports.isAssetRequirementKind = isAssetRequirementKind;
exports.normalizeAssetRequirementKind = normalizeAssetRequirementKind;
exports.isAssetRequirementHostKind = isAssetRequirementHostKind;
exports.normalizeAssetRequirementHostKind = normalizeAssetRequirementHostKind;
exports.isAssetRequirementPermissionKind = isAssetRequirementPermissionKind;
exports.normalizeAssetRequirementPermissionKind = normalizeAssetRequirementPermissionKind;
exports.isAssetRequirementSafetyStatus = isAssetRequirementSafetyStatus;
exports.normalizeAssetRequirementSafetyStatus = normalizeAssetRequirementSafetyStatus;
exports.ASSET_REQUIREMENT_KINDS = [
    "runtime-capability",
    "host",
    "permission",
    "network-access",
    "filesystem-access",
    "secret-access",
    "user-approval",
    "thin-client-safety",
    "automation-safety",
    "resource",
    "artifact",
    "external-provider",
    "custom",
];
exports.ASSET_REQUIREMENT_HOST_KINDS = [
    "desktop",
    "server",
    "thin-client",
    "desktop-or-server",
    "server-backed-thin-client",
];
exports.ASSET_REQUIREMENT_PERMISSION_KINDS = [
    "filesystem-read",
    "filesystem-write",
    "network",
    "secret-read",
    "runtime-execution",
    "external-provider-access",
    "artifact-read",
    "artifact-write",
    "resource-read",
    "resource-write",
];
exports.ASSET_REQUIREMENT_SAFETY_STATUSES = [
    "safe",
    "unsafe",
    "requires-review",
    "unknown",
];
function isAssetRequirementKind(value) {
    return exports.ASSET_REQUIREMENT_KINDS.includes(value);
}
function normalizeAssetRequirementKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetRequirementKind(normalized)) {
        throw new Error("Asset requirement kind must be one of ".concat(exports.ASSET_REQUIREMENT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetRequirementHostKind(value) {
    return exports.ASSET_REQUIREMENT_HOST_KINDS.includes(value);
}
function normalizeAssetRequirementHostKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetRequirementHostKind(normalized)) {
        throw new Error("Asset requirement host kind must be one of ".concat(exports.ASSET_REQUIREMENT_HOST_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetRequirementPermissionKind(value) {
    return exports.ASSET_REQUIREMENT_PERMISSION_KINDS.includes(value);
}
function normalizeAssetRequirementPermissionKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetRequirementPermissionKind(normalized)) {
        throw new Error("Asset requirement permission kind must be one of ".concat(exports.ASSET_REQUIREMENT_PERMISSION_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetRequirementSafetyStatus(value) {
    return exports.ASSET_REQUIREMENT_SAFETY_STATUSES.includes(value);
}
function normalizeAssetRequirementSafetyStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetRequirementSafetyStatus(normalized)) {
        throw new Error("Asset requirement safety status must be one of ".concat(exports.ASSET_REQUIREMENT_SAFETY_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
