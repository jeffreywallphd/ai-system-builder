"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_TYPES = void 0;
exports.isAssetType = isAssetType;
exports.normalizeAssetType = normalizeAssetType;
exports.ASSET_TYPES = [
    "ui-component",
    "page",
    "tool",
    "workflow",
    "workflow-step",
    "schema",
    "prompt-template",
    "data-source",
    "runtime-binding",
    "adapter-binding",
    "model",
    "dataset",
    "image",
    "document",
    "feature",
    "subsystem",
    "system",
    "policy",
    "test",
];
function isAssetType(value) {
    return exports.ASSET_TYPES.includes(value);
}
function normalizeAssetType(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetType(normalized)) {
        throw new Error("Asset type must be one of ".concat(exports.ASSET_TYPES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
