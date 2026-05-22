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
exports.MAX_LIST_MODELS_LIMIT = exports.DEFAULT_LIST_MODELS_LIMIT = void 0;
exports.normalizeListModelsRequest = normalizeListModelsRequest;
exports.normalizeListModelsResult = normalizeListModelsResult;
exports.normalizeSaveModelReferenceRequest = normalizeSaveModelReferenceRequest;
exports.normalizeDownloadModelRequest = normalizeDownloadModelRequest;
exports.normalizeRegisterDownloadedModelRequest = normalizeRegisterDownloadedModelRequest;
exports.normalizeRegisterGeneratedModelRequest = normalizeRegisterGeneratedModelRequest;
exports.normalizeUpdateModelRecordRequest = normalizeUpdateModelRecordRequest;
exports.normalizeDeleteModelRecordRequest = normalizeDeleteModelRecordRequest;
var model_1 = require("../../domain/model");
var model_inference_mode_1 = require("./model-inference-mode");
var model_browse_provider_1 = require("./model-browse-provider");
var model_inventory_1 = require("./model-inventory");
var workspace_1 = require("../workspace");
var model_validation_1 = require("./model-validation");
exports.DEFAULT_LIST_MODELS_LIMIT = 50;
exports.MAX_LIST_MODELS_LIMIT = 500;
function normalizeWorkspaceId(value) {
    if (typeof value !== "string") {
        throw new Error("workspaceId must be provided for workspace-scoped model operations.");
    }
    return (0, workspace_1.createWorkspaceId)(value);
}
function normalizeOptionalText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeRequiredText(value, fieldName) {
    var normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error("".concat(fieldName, " must be a non-empty trimmed string."));
    }
    return normalized;
}
function normalizeOptionalStringList(value) {
    if (!value) {
        return undefined;
    }
    var normalized = value.map(function (entry) { return entry.trim(); }).filter(function (entry) { return entry.length > 0; });
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeListLimit(limit) {
    if (typeof limit !== "number" || !Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
        return exports.DEFAULT_LIST_MODELS_LIMIT;
    }
    return Math.min(limit, exports.MAX_LIST_MODELS_LIMIT);
}
function normalizeListModelsRequest(request) {
    return {
        workspaceId: normalizeWorkspaceId(request.workspaceId),
        source: typeof request.source === "string" ? (0, model_1.normalizeModelSource)(request.source) : undefined,
        lifecycleStatus: typeof request.lifecycleStatus === "string"
            ? (0, model_1.normalizeModelLifecycleStatus)(request.lifecycleStatus)
            : undefined,
        artifactForm: typeof request.artifactForm === "string" ? (0, model_1.normalizeModelArtifactForm)(request.artifactForm) : undefined,
        provider: typeof request.provider === "string" ? (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider) : undefined,
        taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags),
        search: normalizeOptionalText(request.search),
        limit: normalizeListLimit(request.limit),
        cursor: normalizeOptionalText(request.cursor),
        includeDiscovered: request.includeDiscovered === false ? false : undefined,
    };
}
function normalizeListModelsResult(result) {
    return {
        models: result.models.map(function (model) { return (0, model_inventory_1.normalizeModelInventoryRecord)(model); }),
        nextCursor: normalizeOptionalText(result.nextCursor),
    };
}
function normalizeSaveModelReferenceRequest(request) {
    return {
        workspaceId: normalizeWorkspaceId(request.workspaceId),
        modelRecordId: normalizeOptionalText(request.modelRecordId),
        provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider),
        modelId: normalizeRequiredText(request.modelId, "modelId"),
        displayName: normalizeOptionalText(request.displayName),
        inferenceMode: typeof request.inferenceMode === "string" ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.inferenceMode) : undefined,
        taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags),
        artifactForm: typeof request.artifactForm === "string" ? (0, model_1.normalizeModelArtifactForm)(request.artifactForm) : undefined,
        metadata: request.metadata,
    };
}
function normalizeDownloadModelRequest(request) {
    return {
        workspaceId: normalizeWorkspaceId(request.workspaceId),
        modelRecordId: normalizeOptionalText(request.modelRecordId),
        provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider),
        modelId: normalizeRequiredText(request.modelId, "modelId"),
        displayName: normalizeOptionalText(request.displayName),
        inferenceMode: typeof request.inferenceMode === "string" ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.inferenceMode) : undefined,
        taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags),
        artifactForm: typeof request.artifactForm === "string" ? (0, model_1.normalizeModelArtifactForm)(request.artifactForm) : undefined,
        metadata: request.metadata,
    };
}
function normalizeRegisterDownloadedModelRequest(request) {
    return __assign(__assign({}, request), { workspaceId: normalizeWorkspaceId(request.workspaceId), modelRecordId: normalizeOptionalText(request.modelRecordId), displayName: normalizeRequiredText(request.displayName, "displayName"), source: (0, model_1.normalizeModelSource)(request.source), provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider), modelId: normalizeOptionalText(request.modelId), localPath: normalizeOptionalText(request.localPath), backingArtifactIds: normalizeOptionalStringList(request.backingArtifactIds), primaryArtifactId: normalizeOptionalText(request.primaryArtifactId), artifactForm: (0, model_1.normalizeModelArtifactForm)(request.artifactForm), inferenceMode: typeof request.inferenceMode === "string" ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.inferenceMode) : undefined, taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags), baseModelId: normalizeOptionalText(request.baseModelId), adapterOfModelId: normalizeOptionalText(request.adapterOfModelId), serializationFormat: normalizeOptionalText(request.serializationFormat), sizeBytes: typeof request.sizeBytes === "number" && request.sizeBytes >= 0 ? request.sizeBytes : undefined, validationStatus: typeof request.validationStatus === "string"
            ? (0, model_validation_1.normalizeModelValidationStatus)(request.validationStatus)
            : undefined, validationReportPath: normalizeOptionalText(request.validationReportPath), metadata: request.metadata });
}
function normalizeRegisterGeneratedModelRequest(request) {
    return __assign(__assign({}, request), { workspaceId: normalizeWorkspaceId(request.workspaceId), modelRecordId: normalizeOptionalText(request.modelRecordId), displayName: normalizeRequiredText(request.displayName, "displayName"), provider: typeof request.provider === "string" ? (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider) : "unknown", modelId: normalizeOptionalText(request.modelId), localPath: normalizeOptionalText(request.localPath), backingArtifactIds: normalizeOptionalStringList(request.backingArtifactIds), primaryArtifactId: normalizeOptionalText(request.primaryArtifactId), artifactForm: (0, model_1.normalizeModelArtifactForm)(request.artifactForm), inferenceMode: typeof request.inferenceMode === "string" ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.inferenceMode) : undefined, taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags), baseModelId: normalizeOptionalText(request.baseModelId), adapterOfModelId: normalizeOptionalText(request.adapterOfModelId), generatedFromRunId: normalizeOptionalText(request.generatedFromRunId), serializationFormat: normalizeOptionalText(request.serializationFormat), sizeBytes: typeof request.sizeBytes === "number" && request.sizeBytes >= 0 ? request.sizeBytes : undefined, validationStatus: typeof request.validationStatus === "string"
            ? (0, model_validation_1.normalizeModelValidationStatus)(request.validationStatus)
            : undefined, validationReportPath: normalizeOptionalText(request.validationReportPath), metadata: request.metadata });
}
function normalizeUpdateModelRecordRequest(request) {
    return {
        workspaceId: normalizeWorkspaceId(request.workspaceId),
        modelRecordId: normalizeRequiredText(request.modelRecordId, "modelRecordId"),
        patch: request.patch,
    };
}
function normalizeDeleteModelRecordRequest(request) {
    return {
        workspaceId: normalizeWorkspaceId(request.workspaceId),
        modelRecordId: normalizeRequiredText(request.modelRecordId, "modelRecordId"),
        deleteLocalFiles: request.deleteLocalFiles === true,
        deleteBackingArtifacts: request.deleteBackingArtifacts === true,
    };
}
