"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_INSTALL_STATUSES = void 0;
exports.isAssetPackInstallStatus = isAssetPackInstallStatus;
exports.normalizeAssetPackInstallStatus = normalizeAssetPackInstallStatus;
exports.ASSET_PACK_INSTALL_STATUSES = [
    "cataloged",
    "installed",
    "active",
    "disabled",
    "blocked",
    "removed",
];
function isAssetPackInstallStatus(value) {
    return exports.ASSET_PACK_INSTALL_STATUSES.includes(value);
}
function normalizeAssetPackInstallStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackInstallStatus(normalized)) {
        throw new Error("Asset pack install status must be one of ".concat(exports.ASSET_PACK_INSTALL_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
