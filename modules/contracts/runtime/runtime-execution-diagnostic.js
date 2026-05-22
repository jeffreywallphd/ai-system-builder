"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRuntimeDiagnosticEvent = isRuntimeDiagnosticEvent;
exports.normalizeRuntimeDiagnosticEvent = normalizeRuntimeDiagnosticEvent;
exports.createRuntimeExecutionDiagnostic = createRuntimeExecutionDiagnostic;
exports.mapRuntimeDiagnosticToStructuredLogEvent = mapRuntimeDiagnosticToStructuredLogEvent;
function isRuntimeDiagnosticEvent(value) {
    return value.startsWith("runtime.") && value.length > "runtime.".length;
}
function normalizeRuntimeDiagnosticEvent(event) {
    var normalizedEvent = event.trim().toLowerCase();
    if (!isRuntimeDiagnosticEvent(normalizedEvent)) {
        throw new Error("Runtime diagnostic events must use the runtime.* namespace");
    }
    return normalizedEvent;
}
function createRuntimeExecutionDiagnostic(diagnostic) {
    return __assign(__assign({}, diagnostic), { event: normalizeRuntimeDiagnosticEvent(diagnostic.event) });
}
function mapRuntimeDiagnosticToStructuredLogEvent(diagnostic, context) {
    var _a;
    return {
        timestamp: diagnostic.timestamp,
        level: diagnostic.level,
        verbosity: diagnostic.verbosity,
        event: diagnostic.event,
        message: diagnostic.message,
        component: diagnostic.component,
        operation: (_a = diagnostic.operation) !== null && _a !== void 0 ? _a : context === null || context === void 0 ? void 0 : context.operation,
        useCase: context === null || context === void 0 ? void 0 : context.useCase,
        host: context === null || context === void 0 ? void 0 : context.host,
        subsystem: context === null || context === void 0 ? void 0 : context.subsystem,
        outcome: diagnostic.outcome,
        durationMs: diagnostic.durationMs,
        data: diagnostic.data,
        error: diagnostic.error,
        requestId: context === null || context === void 0 ? void 0 : context.requestId,
        correlationId: context === null || context === void 0 ? void 0 : context.correlationId,
    };
}
