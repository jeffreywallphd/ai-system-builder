"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeExecutionProgressEvent = createRuntimeExecutionProgressEvent;
function createRuntimeExecutionProgressEvent(operation, executionId, target, stage, options) {
    var _a;
    return {
        type: "progress",
        timestamp: new Date().toISOString(),
        operation: operation,
        executionId: executionId,
        target: target,
        sequence: (_a = options === null || options === void 0 ? void 0 : options.sequence) !== null && _a !== void 0 ? _a : 0,
        stage: stage,
        message: options === null || options === void 0 ? void 0 : options.message,
        percent: options === null || options === void 0 ? void 0 : options.percent,
        diagnostic: options === null || options === void 0 ? void 0 : options.diagnostic,
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
        metadata: options === null || options === void 0 ? void 0 : options.metadata,
    };
}
