"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOST_ID_FORMAT_DESCRIPTION = void 0;
exports.normalizeHostId = normalizeHostId;
exports.createHostIdentity = createHostIdentity;
var host_kind_1 = require("./host-kind");
exports.HOST_ID_FORMAT_DESCRIPTION = "a non-empty, trimmed host identifier string";
function invalidHostIdMessage(id) {
    return "Host id must be ".concat(exports.HOST_ID_FORMAT_DESCRIPTION, ". Received \"").concat(id, "\".");
}
function normalizeHostId(id) {
    var normalizedId = id.trim();
    if (normalizedId.length === 0) {
        throw new Error(invalidHostIdMessage(id));
    }
    return normalizedId;
}
function createHostIdentity(kind, options) {
    return {
        kind: (0, host_kind_1.resolveHostKind)(kind),
        id: (options === null || options === void 0 ? void 0 : options.id) === undefined ? undefined : normalizeHostId(options.id),
    };
}
