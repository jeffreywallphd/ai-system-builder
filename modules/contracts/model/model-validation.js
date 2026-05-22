"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_VALIDATION_STATUSES = void 0;
exports.normalizeModelValidationStatus = normalizeModelValidationStatus;
exports.normalizeModelValidationSummary = normalizeModelValidationSummary;
exports.normalizeValidateModelRequest = normalizeValidateModelRequest;
var workspace_1 = require("../workspace");
var model_1 = require("../../domain/model");
exports.MODEL_VALIDATION_STATUSES = ["unknown", "valid", "invalid", "warning"];
var MODEL_VALIDATION_STATUS_SET = new Set(exports.MODEL_VALIDATION_STATUSES);
function normalizeOptionalText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeStringList(values) {
    var normalized = values === null || values === void 0 ? void 0 : values.map(function (value) { return value.trim(); }).filter(function (value) { return value.length > 0; });
    return normalized && normalized.length > 0 ? normalized : undefined;
}
function normalizeModelValidationStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (MODEL_VALIDATION_STATUS_SET.has(normalized)) {
        return normalized;
    }
    throw new Error("Model validation status must be one of: ".concat(exports.MODEL_VALIDATION_STATUSES.join(", "), ". Received: ").concat(value));
}
function normalizeModelValidationSummary(summary) {
    return {
        status: normalizeModelValidationStatus(summary.status),
        checkedAt: normalizeOptionalText(summary.checkedAt),
        reportPath: normalizeOptionalText(summary.reportPath),
        expectedLoRA: typeof summary.expectedLoRA === "boolean" ? summary.expectedLoRA : undefined,
        expectedRecurrentAdditions: typeof summary.expectedRecurrentAdditions === "boolean" ? summary.expectedRecurrentAdditions : undefined,
        detectedLoRA: typeof summary.detectedLoRA === "boolean" ? summary.detectedLoRA : undefined,
        detectedRecurrentAdditions: typeof summary.detectedRecurrentAdditions === "boolean" ? summary.detectedRecurrentAdditions : undefined,
        serializationFormat: typeof summary.serializationFormat === "string"
            ? (0, model_1.normalizeModelSerializationFormat)(summary.serializationFormat)
            : undefined,
        shardCount: typeof summary.shardCount === "number" ? summary.shardCount : undefined,
        warnings: normalizeStringList(summary.warnings),
        errors: normalizeStringList(summary.errors),
    };
}
function normalizeRequiredWorkspaceId(value) {
    if (typeof value !== "string") {
        throw new Error("workspaceId must be provided for workspace-scoped model operations.");
    }
    return (0, workspace_1.createWorkspaceId)(value);
}
function normalizeValidateModelRequest(request) {
    return {
        workspaceId: normalizeRequiredWorkspaceId(request.workspaceId),
        modelRecordId: normalizeRequiredText(request.modelRecordId, "modelRecordId"),
        modelPath: normalizeOptionalText(request.modelPath),
        reportOutputDirectory: normalizeOptionalText(request.reportOutputDirectory),
        expectedLoRA: typeof request.expectedLoRA === "boolean" ? request.expectedLoRA : undefined,
        expectedRecurrentAdditions: typeof request.expectedRecurrentAdditions === "boolean" ? request.expectedRecurrentAdditions : undefined,
        allowWarnings: typeof request.allowWarnings === "boolean" ? request.allowWarnings : undefined,
        validationStrictness: request.validationStrictness === "publish" ? "publish" : request.validationStrictness === "normal" ? "normal" : undefined,
    };
}
function normalizeRequiredText(value, fieldName) {
    var normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error("".concat(fieldName, " must be a non-empty trimmed string."));
    }
    return normalized;
}
