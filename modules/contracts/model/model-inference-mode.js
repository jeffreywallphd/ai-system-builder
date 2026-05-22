"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_INFERENCE_MODES = void 0;
exports.normalizeModelInferenceMode = normalizeModelInferenceMode;
exports.MODEL_INFERENCE_MODES = ["text2text", "causal", "chat", "text-to-image"];
var MODEL_INFERENCE_MODE_SET = new Set(exports.MODEL_INFERENCE_MODES);
function normalizeModelInferenceMode(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_INFERENCE_MODE_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model inference mode must be one of: ".concat(exports.MODEL_INFERENCE_MODES.join(", "), ". Received: ").concat(value));
}
