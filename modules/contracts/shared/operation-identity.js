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
exports.OPERATION_IDENTITY_FORMAT_DESCRIPTION = exports.OPERATION_IDENTITY_PATTERN = void 0;
exports.isOperationIdentity = isOperationIdentity;
exports.normalizeOperationIdentity = normalizeOperationIdentity;
exports.createOperationIdentity = createOperationIdentity;
var OPERATION_IDENTITY_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
exports.OPERATION_IDENTITY_PATTERN = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\.(?:[a-z0-9]+(?:-[a-z0-9]+)*))+$/;
exports.OPERATION_IDENTITY_FORMAT_DESCRIPTION = "lowercase dot-separated segments with at least two segments; segments allow a-z, 0-9, and internal hyphen";
function invalidOperationIdentityMessage(value) {
    return "Operation identity must use ".concat(exports.OPERATION_IDENTITY_FORMAT_DESCRIPTION, ". Received \"").concat(value, "\".");
}
function isOperationIdentity(value) {
    return exports.OPERATION_IDENTITY_PATTERN.test(value);
}
function normalizeOperationIdentity(value) {
    var normalizedSegments = value
        .split(".")
        .map(function (segment) { return segment.trim().toLowerCase(); });
    if (normalizedSegments.length < 2) {
        throw new Error(invalidOperationIdentityMessage(value));
    }
    for (var _i = 0, normalizedSegments_1 = normalizedSegments; _i < normalizedSegments_1.length; _i++) {
        var segment = normalizedSegments_1[_i];
        if (!OPERATION_IDENTITY_SEGMENT_PATTERN.test(segment)) {
            throw new Error(invalidOperationIdentityMessage(value));
        }
    }
    var normalizedValue = normalizedSegments.join(".");
    if (!isOperationIdentity(normalizedValue)) {
        throw new Error(invalidOperationIdentityMessage(value));
    }
    return normalizedValue;
}
function createOperationIdentity(firstSegment, secondSegment) {
    var remainingSegments = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        remainingSegments[_i - 2] = arguments[_i];
    }
    return normalizeOperationIdentity(__spreadArray([firstSegment, secondSegment], remainingSegments, true).join("."));
}
