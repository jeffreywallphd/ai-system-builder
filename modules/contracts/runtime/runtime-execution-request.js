"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeExecutionRequest = createRuntimeExecutionRequest;
var runtime_target_1 = require("./runtime-target");
function createRuntimeExecutionRequest(operation, input, options) {
    var _a;
    return {
        executionId: options.executionId,
        operation: operation,
        input: input,
        target: (_a = options.target) !== null && _a !== void 0 ? _a : (0, runtime_target_1.createRuntimeTarget)(options.runtimeKind),
        requestId: options.requestId,
        correlationId: options.correlationId,
        causationId: options.causationId,
        options: options.executionOptions,
        metadata: options.metadata,
    };
}
