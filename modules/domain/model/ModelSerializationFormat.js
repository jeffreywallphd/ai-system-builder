"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_SERIALIZATION_FORMATS = void 0;
exports.normalizeModelSerializationFormat = normalizeModelSerializationFormat;
exports.MODEL_SERIALIZATION_FORMATS = [
    "safetensors",
    "sharded-safetensors",
    "pytorch-bin",
    "adapter-safetensors",
    "unknown",
];
var MODEL_SERIALIZATION_FORMAT_SET = new Set(exports.MODEL_SERIALIZATION_FORMATS);
function normalizeModelSerializationFormat(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_SERIALIZATION_FORMAT_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model serialization format must be one of: ".concat(exports.MODEL_SERIALIZATION_FORMATS.join(", "), ". Received: ").concat(value));
}
