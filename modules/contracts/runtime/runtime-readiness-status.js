"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_READINESS_STATUSES = void 0;
exports.isRuntimeReadinessStatus = isRuntimeReadinessStatus;
exports.normalizeRuntimeReadinessStatus = normalizeRuntimeReadinessStatus;
exports.RUNTIME_READINESS_STATUSES = [
    "unknown",
    "unavailable",
    "not-installed",
    "installing",
    "starting",
    "ready",
    "degraded",
    "failed",
];
function isRuntimeReadinessStatus(value) {
    return exports.RUNTIME_READINESS_STATUSES.includes(value);
}
function normalizeRuntimeReadinessStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isRuntimeReadinessStatus(normalized)) {
        throw new Error("Unknown runtime readiness status: ".concat(value));
    }
    return normalized;
}
