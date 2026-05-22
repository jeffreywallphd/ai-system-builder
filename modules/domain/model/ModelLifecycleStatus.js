"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_LIFECYCLE_STATUSES = void 0;
exports.normalizeModelLifecycleStatus = normalizeModelLifecycleStatus;
exports.MODEL_LIFECYCLE_STATUSES = [
    "remote-reference",
    "saved-reference",
    "downloaded",
    "generated",
    "validated",
    "invalid",
];
var MODEL_LIFECYCLE_STATUS_SET = new Set(exports.MODEL_LIFECYCLE_STATUSES);
function normalizeModelLifecycleStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_LIFECYCLE_STATUS_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model lifecycle status must be one of: ".concat(exports.MODEL_LIFECYCLE_STATUSES.join(", "), ". Received: ").concat(value));
}
