"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_SOURCES = void 0;
exports.normalizeModelSource = normalizeModelSource;
exports.MODEL_SOURCES = ["huggingface", "local", "generated"];
var MODEL_SOURCE_SET = new Set(exports.MODEL_SOURCES);
function normalizeModelSource(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_SOURCE_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model source must be one of: ".concat(exports.MODEL_SOURCES.join(", "), ". Received: ").concat(value));
}
