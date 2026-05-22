"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExecutionPlanFailure = exports.createExecutionPlanSuccess = void 0;
var execution_plan_normalization_1 = require("./execution-plan-normalization");
var createExecutionPlanSuccess = function (value) { return ({ kind: 'success', value: value }); };
exports.createExecutionPlanSuccess = createExecutionPlanSuccess;
var createExecutionPlanFailure = function (failureKind, diagnostics) { return ({ kind: 'failure', failureKind: failureKind, diagnostics: diagnostics.map(execution_plan_normalization_1.normalizeExecutionDiagnostic) }); };
exports.createExecutionPlanFailure = createExecutionPlanFailure;
