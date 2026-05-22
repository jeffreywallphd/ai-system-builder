"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionSafetyGateStatus = exports.isExecutionSafetyGateStatus = exports.normalizeExecutionSafetyGateKind = exports.isExecutionSafetyGateKind = void 0;
var kinds = ['required-input-available', 'output-destination-planned', 'provider-setup-selected', 'storage-destination-safe', 'no-unresolved-blockers', 'user-review-required', 'policy-review-required', 'resource-estimate-review', 'execution-preview-reviewed', 'credentials-not-embedded', 'unsafe-details-redacted', 'executable-payload-deferred'];
var statuses = ['planned', 'passed-by-plan', 'needs-review', 'blocked', 'failed', 'deferred', 'not-applicable'];
var isExecutionSafetyGateKind = function (v) { return kinds.includes(v); };
exports.isExecutionSafetyGateKind = isExecutionSafetyGateKind;
var normalizeExecutionSafetyGateKind = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionSafetyGateKind)(n))
    return n; throw new Error('ExecutionSafetyGateKind invalid.'); };
exports.normalizeExecutionSafetyGateKind = normalizeExecutionSafetyGateKind;
var isExecutionSafetyGateStatus = function (v) { return statuses.includes(v); };
exports.isExecutionSafetyGateStatus = isExecutionSafetyGateStatus;
var normalizeExecutionSafetyGateStatus = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionSafetyGateStatus)(n))
    return n; throw new Error('ExecutionSafetyGateStatus invalid.'); };
exports.normalizeExecutionSafetyGateStatus = normalizeExecutionSafetyGateStatus;
