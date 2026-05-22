"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_VERBOSITIES = void 0;
exports.isLogVerbosity = isLogVerbosity;
exports.resolveLogVerbosity = resolveLogVerbosity;
exports.LOG_VERBOSITIES = [
    "minimal",
    "normal",
    "verbose",
    "trace",
];
function isLogVerbosity(value) {
    return exports.LOG_VERBOSITIES.includes(value);
}
function resolveLogVerbosity(value, fallback) {
    if (fallback === void 0) { fallback = "normal"; }
    if (!value) {
        return fallback;
    }
    var normalizedValue = value.trim().toLowerCase();
    if (isLogVerbosity(normalizedValue)) {
        return normalizedValue;
    }
    return fallback;
}
