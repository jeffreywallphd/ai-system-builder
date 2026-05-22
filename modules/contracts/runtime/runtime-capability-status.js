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
exports.createRuntimeCapabilityStatus = createRuntimeCapabilityStatus;
var runtime_capability_id_1 = require("./runtime-capability-id");
var runtime_readiness_action_1 = require("./runtime-readiness-action");
var runtime_readiness_status_1 = require("./runtime-readiness-status");
function defaultHealthy(status) {
    return status === "ready";
}
function defaultAvailable(status) {
    return status === "ready" || status === "degraded";
}
function normalizeDependency(dependency) {
    var _a, _b;
    var status = (0, runtime_readiness_status_1.normalizeRuntimeReadinessStatus)(dependency.status);
    return __assign(__assign({}, dependency), { capabilityId: (0, runtime_capability_id_1.normalizeRuntimeCapabilityId)(dependency.capabilityId), status: status, healthy: (_a = dependency.healthy) !== null && _a !== void 0 ? _a : defaultHealthy(status), available: (_b = dependency.available) !== null && _b !== void 0 ? _b : defaultAvailable(status) });
}
function createRuntimeCapabilityStatus(input) {
    var _a, _b, _c, _d;
    var status = (0, runtime_readiness_status_1.normalizeRuntimeReadinessStatus)(input.status);
    return __assign(__assign({}, input), { capabilityId: (0, runtime_capability_id_1.normalizeRuntimeCapabilityId)(input.capabilityId), status: status, healthy: (_a = input.healthy) !== null && _a !== void 0 ? _a : defaultHealthy(status), available: (_b = input.available) !== null && _b !== void 0 ? _b : defaultAvailable(status), recommendedActions: (_c = input.recommendedActions) === null || _c === void 0 ? void 0 : _c.map(runtime_readiness_action_1.normalizeRuntimeReadinessAction), dependencies: (_d = input.dependencies) === null || _d === void 0 ? void 0 : _d.map(normalizeDependency) });
}
