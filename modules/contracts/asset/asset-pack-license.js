"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_LICENSE_KINDS = void 0;
exports.isAssetPackLicenseKind = isAssetPackLicenseKind;
exports.normalizeAssetPackLicenseKind = normalizeAssetPackLicenseKind;
exports.ASSET_PACK_LICENSE_KINDS = [
    "internal",
    "proprietary",
    "permissive",
    "copyleft",
    "public-domain",
    "unknown",
];
function isAssetPackLicenseKind(value) {
    return exports.ASSET_PACK_LICENSE_KINDS.includes(value);
}
function normalizeAssetPackLicenseKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackLicenseKind(normalized)) {
        throw new Error("Asset pack license kind must be one of ".concat(exports.ASSET_PACK_LICENSE_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
