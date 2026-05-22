"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_ARTIFACT_FORMS = void 0;
exports.normalizeModelArtifactForm = normalizeModelArtifactForm;
exports.MODEL_ARTIFACT_FORMS = [
    "full-model",
    "adapter",
    "merged-model",
    "quantized-model",
    "checkpoint",
];
var MODEL_ARTIFACT_FORM_SET = new Set(exports.MODEL_ARTIFACT_FORMS);
function normalizeModelArtifactForm(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_ARTIFACT_FORM_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model artifact form must be one of: ".concat(exports.MODEL_ARTIFACT_FORMS.join(", "), ". Received: ").concat(value));
}
