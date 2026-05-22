"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_READINESS_ACTIONS = void 0;
exports.isRuntimeReadinessAction = isRuntimeReadinessAction;
exports.normalizeRuntimeReadinessAction = normalizeRuntimeReadinessAction;
exports.RUNTIME_READINESS_ACTIONS = [
    "wait",
    "start",
    "install",
    "repair",
    "configure",
    "retry",
    "view-logs",
];
function isRuntimeReadinessAction(value) {
    return exports.RUNTIME_READINESS_ACTIONS.includes(value);
}
function normalizeRuntimeReadinessAction(value) {
    var normalized = value.trim().toLowerCase();
    if (!isRuntimeReadinessAction(normalized)) {
        throw new Error("Unknown runtime readiness action: ".concat(value));
    }
    return normalized;
}
