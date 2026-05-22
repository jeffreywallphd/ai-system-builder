"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_OVERRIDE_CONFLICT_POLICIES = exports.ASSET_PACK_OVERRIDE_SCOPES = void 0;
exports.isAssetPackOverrideScope = isAssetPackOverrideScope;
exports.normalizeAssetPackOverrideScope = normalizeAssetPackOverrideScope;
exports.isAssetPackOverrideConflictPolicy = isAssetPackOverrideConflictPolicy;
exports.normalizeAssetPackOverrideConflictPolicy = normalizeAssetPackOverrideConflictPolicy;
exports.ASSET_PACK_OVERRIDE_SCOPES = [
    "workspace",
    "organization",
    "user",
    "system",
];
exports.ASSET_PACK_OVERRIDE_CONFLICT_POLICIES = [
    "prefer-replacement",
    "prefer-existing",
    "report-conflict",
    "disabled",
];
function isAssetPackOverrideScope(value) {
    return exports.ASSET_PACK_OVERRIDE_SCOPES.includes(value);
}
function normalizeAssetPackOverrideScope(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackOverrideScope(normalized)) {
        throw new Error("Asset pack override scope must be one of ".concat(exports.ASSET_PACK_OVERRIDE_SCOPES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetPackOverrideConflictPolicy(value) {
    return exports.ASSET_PACK_OVERRIDE_CONFLICT_POLICIES.includes(value);
}
function normalizeAssetPackOverrideConflictPolicy(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackOverrideConflictPolicy(normalized)) {
        throw new Error("Asset pack override conflict policy must be one of ".concat(exports.ASSET_PACK_OVERRIDE_CONFLICT_POLICIES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
