"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_EXTERNAL_REPOSITORY_OBJECT_KINDS = exports.ASSET_EXTERNAL_REPOSITORY_PROVIDERS = void 0;
exports.isAssetExternalRepositoryProvider = isAssetExternalRepositoryProvider;
exports.normalizeAssetExternalRepositoryProvider = normalizeAssetExternalRepositoryProvider;
exports.isAssetExternalRepositoryObjectKind = isAssetExternalRepositoryObjectKind;
exports.normalizeAssetExternalRepositoryObjectKind = normalizeAssetExternalRepositoryObjectKind;
exports.ASSET_EXTERNAL_REPOSITORY_PROVIDERS = [
    "huggingface",
    "local",
    "github",
    "http",
    "custom",
];
exports.ASSET_EXTERNAL_REPOSITORY_OBJECT_KINDS = [
    "repository",
    "file",
    "directory",
    "model",
    "dataset",
    "artifact",
    "preview",
    "custom",
];
function isAssetExternalRepositoryProvider(value) {
    return exports.ASSET_EXTERNAL_REPOSITORY_PROVIDERS.includes(value);
}
function normalizeAssetExternalRepositoryProvider(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetExternalRepositoryProvider(normalized)) {
        throw new Error("Asset external repository provider must be one of ".concat(exports.ASSET_EXTERNAL_REPOSITORY_PROVIDERS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
function isAssetExternalRepositoryObjectKind(value) {
    return exports.ASSET_EXTERNAL_REPOSITORY_OBJECT_KINDS.includes(value);
}
function normalizeAssetExternalRepositoryObjectKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetExternalRepositoryObjectKind(normalized)) {
        throw new Error("Asset external repository object kind must be one of ".concat(exports.ASSET_EXTERNAL_REPOSITORY_OBJECT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
