"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PACK_TRUST_STATUSES = void 0;
exports.isAssetPackTrustStatus = isAssetPackTrustStatus;
exports.normalizeAssetPackTrustStatus = normalizeAssetPackTrustStatus;
exports.ASSET_PACK_TRUST_STATUSES = [
    "system-trusted",
    "trusted",
    "unverified",
    "restricted",
    "blocked",
];
function isAssetPackTrustStatus(value) {
    return exports.ASSET_PACK_TRUST_STATUSES.includes(value);
}
function normalizeAssetPackTrustStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPackTrustStatus(normalized)) {
        throw new Error("Asset pack trust status must be one of ".concat(exports.ASSET_PACK_TRUST_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
