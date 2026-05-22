"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResult = createSuccessResult;
exports.createFailureResult = createFailureResult;
exports.isContractSuccess = isContractSuccess;
exports.isContractFailure = isContractFailure;
function createSuccessResult(value, context) {
    return {
        ok: true,
        value: value,
        correlationId: context === null || context === void 0 ? void 0 : context.correlationId,
        requestId: context === null || context === void 0 ? void 0 : context.requestId,
    };
}
function createFailureResult(error, context) {
    var _a, _b;
    return {
        ok: false,
        error: error,
        correlationId: (_a = context === null || context === void 0 ? void 0 : context.correlationId) !== null && _a !== void 0 ? _a : error.correlationId,
        requestId: (_b = context === null || context === void 0 ? void 0 : context.requestId) !== null && _b !== void 0 ? _b : error.requestId,
    };
}
function isContractSuccess(result) {
    return result.ok;
}
function isContractFailure(result) {
    return !result.ok;
}
