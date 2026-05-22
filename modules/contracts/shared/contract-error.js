"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractError = createContractError;
function createContractError(code, message, options) {
    return {
        code: code,
        message: message,
        details: options === null || options === void 0 ? void 0 : options.details,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
    };
}
