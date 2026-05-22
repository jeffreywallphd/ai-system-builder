"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRuntimeOperation = isRuntimeOperation;
exports.normalizeRuntimeOperation = normalizeRuntimeOperation;
exports.createRuntimeOperation = createRuntimeOperation;
var shared_1 = require("../shared");
function isRuntimeOperation(value) {
    return (0, shared_1.isOperationIdentity)(value);
}
function normalizeRuntimeOperation(operation) {
    return (0, shared_1.normalizeOperationIdentity)(operation);
}
function createRuntimeOperation(firstSegment, secondSegment) {
    var remainingSegments = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        remainingSegments[_i - 2] = arguments[_i];
    }
    return shared_1.createOperationIdentity.apply(void 0, __spreadArray([firstSegment, secondSegment], remainingSegments, false));
}
