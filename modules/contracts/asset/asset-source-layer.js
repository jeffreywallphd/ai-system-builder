"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_SOURCE_LAYERS = void 0;
exports.isAssetSourceLayer = isAssetSourceLayer;
exports.normalizeAssetSourceLayer = normalizeAssetSourceLayer;
exports.ASSET_SOURCE_LAYERS = [
    "system-default",
    "installed-pack",
    "workspace-pack",
    "organization-override",
    "user-override",
    "imported-pack",
];
function isAssetSourceLayer(value) {
    return exports.ASSET_SOURCE_LAYERS.includes(value);
}
function normalizeAssetSourceLayer(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetSourceLayer(normalized)) {
        throw new Error("Asset source layer must be one of ".concat(exports.ASSET_SOURCE_LAYERS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
