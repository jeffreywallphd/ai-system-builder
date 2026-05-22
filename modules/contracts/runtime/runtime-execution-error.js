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
exports.createRuntimeExecutionError = createRuntimeExecutionError;
var shared_1 = require("../shared");
function createRuntimeExecutionError(operation, executionId, target, code, message, options) {
    var contractError = (0, shared_1.createContractError)(code, message, {
        details: options === null || options === void 0 ? void 0 : options.details,
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
    });
    return __assign(__assign({}, contractError), { operation: operation, executionId: executionId, target: target });
}
