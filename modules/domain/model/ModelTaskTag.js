"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_TASK_TAGS = void 0;
exports.normalizeModelTaskTag = normalizeModelTaskTag;
exports.normalizeModelTaskTags = normalizeModelTaskTags;
exports.MODEL_TASK_TAGS = [
    "text-generation",
    "text2text-generation",
    "chat",
    "embeddings",
    "classification",
    "summarization",
    "question-answering",
    "code-generation",
    "text-to-image",
];
var MODEL_TASK_TAG_SET = new Set(exports.MODEL_TASK_TAGS);
function normalizeModelTaskTag(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_TASK_TAG_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model task tag must be one of: ".concat(exports.MODEL_TASK_TAGS.join(", "), ". Received: ").concat(value));
}
function normalizeModelTaskTags(values) {
    if (!values) {
        return undefined;
    }
    return values.map(function (value) { return normalizeModelTaskTag(value); });
}
