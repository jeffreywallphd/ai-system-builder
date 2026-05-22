"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_SOURCE_SYSTEMS = exports.ASSET_SOURCE_IDENTITY_KINDS = void 0;
exports.isAssetSourceSystem = isAssetSourceSystem;
exports.isAssetSourceIdentityKind = isAssetSourceIdentityKind;
exports.ASSET_SOURCE_IDENTITY_KINDS = [
    "resource-backed-view",
    "artifact",
    "image-asset",
    "generated-output",
    "dataset",
    "model",
    "external-repository-object",
    "artifact-repository-object",
    "preview",
    "unknown",
];
exports.ASSET_SOURCE_SYSTEMS = [
    "asset-resource-backed-view",
    "artifact",
    "image-asset",
    "generated-output",
    "dataset",
    "model",
    "external-repository-object",
    "artifact-repository",
    "image-generation",
    "unknown",
];
function isAssetSourceSystem(value) {
    return exports.ASSET_SOURCE_SYSTEMS.includes(value);
}
function isAssetSourceIdentityKind(value) {
    return exports.ASSET_SOURCE_IDENTITY_KINDS.includes(value);
}
