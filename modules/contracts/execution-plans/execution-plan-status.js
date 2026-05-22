"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionStepKind = exports.isExecutionStepKind = exports.normalizeExecutionStepStatus = exports.isExecutionStepStatus = exports.normalizeExecutionPlanStatus = exports.isExecutionPlanStatus = void 0;
var executionPlanStatuses = ["draft", "preparing", "ready-for-review", "needs-setup", "missing-inputs", "missing-outputs", "provider-setup-required", "safety-review-required", "blocked", "stale", "invalid", "archived"];
var executionStepStatuses = ["planned", "needs-input", "needs-output", "needs-provider-setup", "needs-review", "blocked", "stale", "invalid", "deferred"];
var executionStepKinds = ["prepare-input", "transform-data", "generate-image", "generate-text", "embed-content", "store-artifact", "read-artifact", "call-api", "compose-output", "validate-output", "manual-review", "safety-check", "provider-setup-check", "runtime-setup-check"];
function normalizeEnum(value, supported, label) { var normalized = value.trim().toLowerCase(); if (supported.includes(normalized))
    return normalized; throw new Error("".concat(label, " is invalid or unsupported for non-executing planning.")); }
var isExecutionPlanStatus = function (v) { return executionPlanStatuses.includes(v); };
exports.isExecutionPlanStatus = isExecutionPlanStatus;
var normalizeExecutionPlanStatus = function (v) { return normalizeEnum(v, executionPlanStatuses, "ExecutionPlanStatus"); };
exports.normalizeExecutionPlanStatus = normalizeExecutionPlanStatus;
var isExecutionStepStatus = function (v) { return executionStepStatuses.includes(v); };
exports.isExecutionStepStatus = isExecutionStepStatus;
var normalizeExecutionStepStatus = function (v) { return normalizeEnum(v, executionStepStatuses, "ExecutionStepStatus"); };
exports.normalizeExecutionStepStatus = normalizeExecutionStepStatus;
var isExecutionStepKind = function (v) { return executionStepKinds.includes(v); };
exports.isExecutionStepKind = isExecutionStepKind;
var normalizeExecutionStepKind = function (v) { return normalizeEnum(v, executionStepKinds, "ExecutionStepKind"); };
exports.normalizeExecutionStepKind = normalizeExecutionStepKind;
