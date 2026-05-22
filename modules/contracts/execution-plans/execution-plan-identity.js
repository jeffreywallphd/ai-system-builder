"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExecutionResourceEstimateId = exports.normalizeExecutionOperationId = exports.normalizeExecutionBlockerId = exports.normalizeExecutionDiagnosticId = exports.normalizeProviderAdapterReferenceId = exports.normalizeExecutionArtifactReferenceId = exports.normalizeExecutionStepGroupId = exports.normalizeExecutionPlanCandidateId = exports.normalizeExecutionSafetyGateId = exports.isExecutionSafetyGateId = exports.normalizeExecutionAdapterReferenceId = exports.isExecutionAdapterReferenceId = exports.normalizeExecutionOutputId = exports.isExecutionOutputId = exports.normalizeExecutionInputId = exports.isExecutionInputId = exports.normalizeExecutionDependencyId = exports.isExecutionDependencyId = exports.normalizeExecutionStepId = exports.isExecutionStepId = exports.normalizeExecutionPlanId = exports.isExecutionPlanId = void 0;
var ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
var SECRET_PATTERN = /(token|secret|apikey|api[-_]?key|private[-_]?key|signature|signed|credential)/i;
function isSafeId(value) {
    if (value.length === 0 || value !== value.trim())
        return false;
    if (!ID_PATTERN.test(value))
        return false;
    if (value.includes("..") || value.includes("\\") || value.includes("/") || value.includes("$"))
        return false;
    if (/^https?:\/\//i.test(value) || /^[a-zA-Z]:[\\/]/.test(value))
        return false;
    if (/[%&;|<>`]/.test(value))
        return false;
    if (/[^\x20-\x7E]/.test(value))
        return false;
    if (SECRET_PATTERN.test(value))
        return false;
    return true;
}
function invalidIdError(label) {
    return new Error("".concat(label, " must be a safe non-empty identifier."));
}
function normalizeBrandedId(value, label) {
    var normalized = value.trim();
    if (!isSafeId(normalized))
        throw invalidIdError(label);
    return normalized;
}
var isExecutionPlanId = function (value) { return isSafeId(value); };
exports.isExecutionPlanId = isExecutionPlanId;
var normalizeExecutionPlanId = function (value) { return normalizeBrandedId(value, "ExecutionPlanId"); };
exports.normalizeExecutionPlanId = normalizeExecutionPlanId;
var isExecutionStepId = function (value) { return isSafeId(value); };
exports.isExecutionStepId = isExecutionStepId;
var normalizeExecutionStepId = function (value) { return normalizeBrandedId(value, "ExecutionStepId"); };
exports.normalizeExecutionStepId = normalizeExecutionStepId;
var isExecutionDependencyId = function (value) { return isSafeId(value); };
exports.isExecutionDependencyId = isExecutionDependencyId;
var normalizeExecutionDependencyId = function (value) { return normalizeBrandedId(value, "ExecutionDependencyId"); };
exports.normalizeExecutionDependencyId = normalizeExecutionDependencyId;
var isExecutionInputId = function (value) { return isSafeId(value); };
exports.isExecutionInputId = isExecutionInputId;
var normalizeExecutionInputId = function (value) { return normalizeBrandedId(value, "ExecutionInputId"); };
exports.normalizeExecutionInputId = normalizeExecutionInputId;
var isExecutionOutputId = function (value) { return isSafeId(value); };
exports.isExecutionOutputId = isExecutionOutputId;
var normalizeExecutionOutputId = function (value) { return normalizeBrandedId(value, "ExecutionOutputId"); };
exports.normalizeExecutionOutputId = normalizeExecutionOutputId;
var isExecutionAdapterReferenceId = function (value) { return isSafeId(value); };
exports.isExecutionAdapterReferenceId = isExecutionAdapterReferenceId;
var normalizeExecutionAdapterReferenceId = function (value) { return normalizeBrandedId(value, "ExecutionAdapterReferenceId"); };
exports.normalizeExecutionAdapterReferenceId = normalizeExecutionAdapterReferenceId;
var isExecutionSafetyGateId = function (value) { return isSafeId(value); };
exports.isExecutionSafetyGateId = isExecutionSafetyGateId;
var normalizeExecutionSafetyGateId = function (value) { return normalizeBrandedId(value, "ExecutionSafetyGateId"); };
exports.normalizeExecutionSafetyGateId = normalizeExecutionSafetyGateId;
var normalizeExecutionPlanCandidateId = function (value) { return normalizeBrandedId(value, "ExecutionPlanCandidateId"); };
exports.normalizeExecutionPlanCandidateId = normalizeExecutionPlanCandidateId;
var normalizeExecutionStepGroupId = function (value) { return normalizeBrandedId(value, "ExecutionStepGroupId"); };
exports.normalizeExecutionStepGroupId = normalizeExecutionStepGroupId;
var normalizeExecutionArtifactReferenceId = function (value) { return normalizeBrandedId(value, "ExecutionArtifactReferenceId"); };
exports.normalizeExecutionArtifactReferenceId = normalizeExecutionArtifactReferenceId;
var normalizeProviderAdapterReferenceId = function (value) { return normalizeBrandedId(value, "ProviderAdapterReferenceId"); };
exports.normalizeProviderAdapterReferenceId = normalizeProviderAdapterReferenceId;
var normalizeExecutionDiagnosticId = function (value) { return normalizeBrandedId(value, "ExecutionDiagnosticId"); };
exports.normalizeExecutionDiagnosticId = normalizeExecutionDiagnosticId;
var normalizeExecutionBlockerId = function (value) { return normalizeBrandedId(value, "ExecutionBlockerId"); };
exports.normalizeExecutionBlockerId = normalizeExecutionBlockerId;
var normalizeExecutionOperationId = function (value) { return normalizeBrandedId(value, "ExecutionOperationId"); };
exports.normalizeExecutionOperationId = normalizeExecutionOperationId;
var normalizeExecutionResourceEstimateId = function (value) { return normalizeBrandedId(value, "ExecutionResourceEstimateId"); };
exports.normalizeExecutionResourceEstimateId = normalizeExecutionResourceEstimateId;
