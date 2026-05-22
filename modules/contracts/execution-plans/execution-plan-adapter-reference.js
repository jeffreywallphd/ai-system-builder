"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionAdapterReferenceStatus = exports.isExecutionAdapterReferenceStatus = exports.normalizeExecutionAdapterReferenceKind = exports.isExecutionAdapterReferenceKind = void 0;
var kinds = ['runtime-readiness-binding', 'selected-runtime-binding', 'provider-capability', 'provider-adapter', 'storage-adapter', 'artifact-adapter', 'model-adapter', 'comfyui-adapter', 'api-adapter', 'manual-adapter', 'deferred-adapter'];
var statuses = ['planned', 'available-by-readiness', 'needs-setup', 'missing', 'blocked', 'unsupported', 'stale', 'invalid', 'deferred'];
var isExecutionAdapterReferenceKind = function (v) { return kinds.includes(v); };
exports.isExecutionAdapterReferenceKind = isExecutionAdapterReferenceKind;
var normalizeExecutionAdapterReferenceKind = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionAdapterReferenceKind)(n))
    return n; throw new Error('ExecutionAdapterReferenceKind invalid.'); };
exports.normalizeExecutionAdapterReferenceKind = normalizeExecutionAdapterReferenceKind;
var isExecutionAdapterReferenceStatus = function (v) { return statuses.includes(v); };
exports.isExecutionAdapterReferenceStatus = isExecutionAdapterReferenceStatus;
var normalizeExecutionAdapterReferenceStatus = function (v) { var n = v.trim().toLowerCase(); if ((0, exports.isExecutionAdapterReferenceStatus)(n))
    return n; throw new Error('ExecutionAdapterReferenceStatus invalid.'); };
exports.normalizeExecutionAdapterReferenceStatus = normalizeExecutionAdapterReferenceStatus;
