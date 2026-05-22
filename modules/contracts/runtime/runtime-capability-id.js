"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_CAPABILITY_IDS = void 0;
exports.isRuntimeCapabilityId = isRuntimeCapabilityId;
exports.normalizeRuntimeCapabilityId = normalizeRuntimeCapabilityId;
exports.RUNTIME_CAPABILITY_IDS = [
    "python-runtime",
    "comfyui-runtime",
    "image-generation",
    "dataset-preparation",
    "model-training",
    "model-validation",
    "model-publishing",
];
function isRuntimeCapabilityId(value) {
    return exports.RUNTIME_CAPABILITY_IDS.includes(value);
}
function normalizeRuntimeCapabilityId(value) {
    var normalized = value.trim().toLowerCase();
    if (!isRuntimeCapabilityId(normalized)) {
        throw new Error("Unknown runtime capability id: ".concat(value));
    }
    return normalized;
}
