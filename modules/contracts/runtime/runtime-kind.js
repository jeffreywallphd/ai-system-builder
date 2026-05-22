"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_RUNTIME_KINDS = void 0;
exports.isKnownRuntimeKind = isKnownRuntimeKind;
exports.resolveRuntimeKind = resolveRuntimeKind;
exports.KNOWN_RUNTIME_KINDS = ["node", "python"];
function isKnownRuntimeKind(value) {
    return exports.KNOWN_RUNTIME_KINDS.includes(value);
}
function resolveRuntimeKind(value, fallback) {
    if (fallback === void 0) { fallback = "node"; }
    var normalized = value === null || value === void 0 ? void 0 : value.trim().toLowerCase();
    if (!normalized) {
        return fallback;
    }
    return isKnownRuntimeKind(normalized)
        ? normalized
        : normalized;
}
