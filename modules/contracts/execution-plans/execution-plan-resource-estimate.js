"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionDurationEstimateCategory = exports.normalizeExecutionStorageEstimateCategory = exports.normalizeExecutionComputeEstimateCategory = void 0;
var compute = ['none', 'low', 'medium', 'high', 'unknown'];
var storage = ['none', 'small', 'medium', 'large', 'unknown'];
var duration = ['instant', 'short', 'medium', 'long', 'unknown'];
var norm = function (v, a, l) { var n = v.trim().toLowerCase(); if (a.includes(n))
    return n; throw new Error("".concat(l, " invalid.")); };
var normalizeExecutionComputeEstimateCategory = function (v) { return norm(v, compute, 'ExecutionComputeEstimateCategory'); };
exports.normalizeExecutionComputeEstimateCategory = normalizeExecutionComputeEstimateCategory;
var normalizeExecutionStorageEstimateCategory = function (v) { return norm(v, storage, 'ExecutionStorageEstimateCategory'); };
exports.normalizeExecutionStorageEstimateCategory = normalizeExecutionStorageEstimateCategory;
var normalizeExecutionDurationEstimateCategory = function (v) { return norm(v, duration, 'ExecutionDurationEstimateCategory'); };
exports.normalizeExecutionDurationEstimateCategory = normalizeExecutionDurationEstimateCategory;
