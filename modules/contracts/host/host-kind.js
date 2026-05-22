"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_HOST_KINDS = void 0;
exports.isKnownHostKind = isKnownHostKind;
exports.resolveHostKind = resolveHostKind;
exports.KNOWN_HOST_KINDS = ["desktop", "server", "hybrid"];
function isKnownHostKind(value) {
    return exports.KNOWN_HOST_KINDS.includes(value);
}
function resolveHostKind(value, fallback) {
    if (fallback === void 0) { fallback = "desktop"; }
    var normalized = value === null || value === void 0 ? void 0 : value.trim().toLowerCase();
    if (!normalized) {
        return fallback;
    }
    return isKnownHostKind(normalized) ? normalized : normalized;
}
