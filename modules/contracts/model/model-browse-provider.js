"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_BROWSE_PROVIDERS = void 0;
exports.normalizeModelBrowseProvider = normalizeModelBrowseProvider;
exports.MODEL_BROWSE_PROVIDERS = ["huggingface", "unknown"];
var MODEL_BROWSE_PROVIDER_SET = new Set(exports.MODEL_BROWSE_PROVIDERS);
function normalizeModelBrowseProvider(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_BROWSE_PROVIDER_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model browse provider must be one of: ".concat(exports.MODEL_BROWSE_PROVIDERS.join(", "), ". Received: ").concat(value));
}
