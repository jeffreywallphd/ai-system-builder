"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionDependencyStatus = exports.isExecutionDependencyStatus = exports.normalizeExecutionDependencyKind = exports.isExecutionDependencyKind = void 0;
var kinds = ["step-after-step", "input-required", "output-required", "provider-required", "safety-gate-required", "manual-review-required", "artifact-required"];
var statuses = ["planned", "satisfied-by-plan", "missing", "blocked", "stale", "invalid"];
var isExecutionDependencyKind = function (v) { return kinds.includes(v); };
exports.isExecutionDependencyKind = isExecutionDependencyKind;
var normalizeExecutionDependencyKind = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionDependencyKind)(n))
    return n; throw new Error('ExecutionDependencyKind is invalid.'); };
exports.normalizeExecutionDependencyKind = normalizeExecutionDependencyKind;
var isExecutionDependencyStatus = function (v) { return statuses.includes(v); };
exports.isExecutionDependencyStatus = isExecutionDependencyStatus;
var normalizeExecutionDependencyStatus = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionDependencyStatus)(n))
    return n; throw new Error('ExecutionDependencyStatus is invalid.'); };
exports.normalizeExecutionDependencyStatus = normalizeExecutionDependencyStatus;
