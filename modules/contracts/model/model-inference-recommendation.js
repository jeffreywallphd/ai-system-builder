"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendModelInferenceMode = recommendModelInferenceMode;
var model_inference_mode_1 = require("./model-inference-mode");
var TASK_TO_INFERENCE_MODE = {
    "text2text-generation": "text2text",
    "summarization": "text2text",
    "question-answering": "text2text",
    "text-generation": "causal",
    "chat": "chat",
    "text-to-image": "text-to-image",
};
function normalizeText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}
function recommendModelInferenceMode(input) {
    var _a;
    var normalizedCandidates = [];
    var pipelineTag = normalizeText(input.pipelineTag);
    if (pipelineTag) {
        normalizedCandidates.push(pipelineTag);
    }
    for (var _i = 0, _b = (_a = input.taskTags) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
        var taskTag = _b[_i];
        var normalizedTaskTag = normalizeText(taskTag);
        if (normalizedTaskTag) {
            normalizedCandidates.push(normalizedTaskTag);
        }
    }
    for (var _c = 0, normalizedCandidates_1 = normalizedCandidates; _c < normalizedCandidates_1.length; _c++) {
        var candidate = normalizedCandidates_1[_c];
        var mapped = TASK_TO_INFERENCE_MODE[candidate];
        if (mapped) {
            return (0, model_inference_mode_1.normalizeModelInferenceMode)(mapped);
        }
    }
    return undefined;
}
