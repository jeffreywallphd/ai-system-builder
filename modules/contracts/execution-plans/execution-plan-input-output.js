"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionInputOutputStatus = exports.isExecutionInputOutputStatus = exports.normalizeExecutionOutputKind = exports.isExecutionOutputKind = exports.normalizeExecutionInputKind = exports.isExecutionInputKind = void 0;
var inputKinds = ['asset-reference', 'artifact-reference', 'workspace-data', 'user-provided', 'provider-configuration-reference', 'runtime-readiness-reference', 'manual-review-input', 'unknown'];
var outputKinds = ['artifact', 'workspace-record', 'asset-candidate', 'report', 'preview', 'diagnostic-summary', 'manual-review-output', 'unknown'];
var statuses = ['planned', 'available', 'missing', 'needs-review', 'blocked', 'stale', 'invalid'];
var isExecutionInputKind = function (v) { return inputKinds.includes(v); };
exports.isExecutionInputKind = isExecutionInputKind;
var normalizeExecutionInputKind = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionInputKind)(n))
    return n; throw new Error('ExecutionInputKind is invalid.'); };
exports.normalizeExecutionInputKind = normalizeExecutionInputKind;
var isExecutionOutputKind = function (v) { return outputKinds.includes(v); };
exports.isExecutionOutputKind = isExecutionOutputKind;
var normalizeExecutionOutputKind = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionOutputKind)(n))
    return n; throw new Error('ExecutionOutputKind is invalid.'); };
exports.normalizeExecutionOutputKind = normalizeExecutionOutputKind;
var isExecutionInputOutputStatus = function (v) { return statuses.includes(v); };
exports.isExecutionInputOutputStatus = isExecutionInputOutputStatus;
var normalizeExecutionInputOutputStatus = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionInputOutputStatus)(n))
    return n; throw new Error('ExecutionInputOutputStatus is invalid.'); };
exports.normalizeExecutionInputOutputStatus = normalizeExecutionInputOutputStatus;
