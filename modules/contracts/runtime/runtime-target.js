"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeTarget = createRuntimeTarget;
var runtime_kind_1 = require("./runtime-kind");
function createRuntimeTarget(kind, options) {
    if (kind === void 0) { kind = "node"; }
    return {
        kind: (0, runtime_kind_1.resolveRuntimeKind)(kind),
        adapter: options === null || options === void 0 ? void 0 : options.adapter,
        capability: options === null || options === void 0 ? void 0 : options.capability,
        metadata: options === null || options === void 0 ? void 0 : options.metadata,
    };
}
