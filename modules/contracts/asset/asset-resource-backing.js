"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_RESOURCE_BACKING_ROLES = void 0;
exports.isAssetResourceBackingRole = isAssetResourceBackingRole;
exports.normalizeAssetResourceBackingRole = normalizeAssetResourceBackingRole;
exports.ASSET_RESOURCE_BACKING_ROLES = [
    "primary",
    "source",
    "derived",
    "preview",
    "thumbnail",
    "materialization",
    "checkpoint",
    "adapter",
    "metadata",
    "custom",
];
function isAssetResourceBackingRole(value) {
    return exports.ASSET_RESOURCE_BACKING_ROLES.includes(value);
}
function normalizeAssetResourceBackingRole(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetResourceBackingRole(normalized)) {
        throw new Error("Asset resource backing role must be one of ".concat(exports.ASSET_RESOURCE_BACKING_ROLES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
