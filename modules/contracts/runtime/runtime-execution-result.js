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
exports.createRuntimeExecutionSuccessResult = createRuntimeExecutionSuccessResult;
exports.createRuntimeExecutionFailureResult = createRuntimeExecutionFailureResult;
var shared_1 = require("../shared");
function createRuntimeExecutionSuccessResult(operation, executionId, target, output, options) {
    var _a;
    var result = (0, shared_1.createSuccessResult)({
        output: output,
        completedAt: (_a = options === null || options === void 0 ? void 0 : options.completedAt) !== null && _a !== void 0 ? _a : new Date().toISOString(),
        durationMs: options === null || options === void 0 ? void 0 : options.durationMs,
        diagnostics: options === null || options === void 0 ? void 0 : options.diagnostics,
    }, {
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
    });
    return __assign(__assign({}, result), { operation: operation, executionId: executionId, target: target, metadata: options === null || options === void 0 ? void 0 : options.metadata });
}
function createRuntimeExecutionFailureResult(error, options) {
    var result = (0, shared_1.createFailureResult)(error, {
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
    });
    return __assign(__assign({}, result), { error: error, operation: error.operation, executionId: error.executionId, target: error.target, metadata: options === null || options === void 0 ? void 0 : options.metadata });
}
