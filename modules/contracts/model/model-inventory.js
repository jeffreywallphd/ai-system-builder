"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeModelInventoryRecord = normalizeModelInventoryRecord;
var model_1 = require("../../domain/model");
var model_browse_provider_1 = require("./model-browse-provider");
var model_inference_mode_1 = require("./model-inference-mode");
var model_validation_1 = require("./model-validation");
function normalizeOptionalText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeOptionalTextList(values) {
    if (!values) {
        return undefined;
    }
    var normalized = values.map(function (value) { return value.trim(); }).filter(function (value) { return value.length > 0; });
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeRequiredText(value, fieldName) {
    var normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error("".concat(fieldName, " must be a non-empty trimmed string."));
    }
    return normalized;
}
function normalizeOptionalNonNegativeNumber(value) {
    if (typeof value !== "number") {
        return undefined;
    }
    return value >= 0 ? value : undefined;
}
function normalizePublishedSummary(value) {
    if (!value) {
        return undefined;
    }
    var repository = normalizeRequiredText(value.repository, "published.repository");
    var publishedAt = normalizeRequiredText(value.publishedAt, "published.publishedAt");
    return {
        provider: "huggingface",
        repository: repository,
        revision: normalizeOptionalText(value.revision),
        url: normalizeOptionalText(value.url),
        publishedAt: publishedAt,
    };
}
function normalizeModelInventoryRecord(record) {
    return {
        workspaceId: record.workspaceId,
        modelRecordId: normalizeRequiredText(record.modelRecordId, "modelRecordId"),
        displayName: normalizeRequiredText(record.displayName, "displayName"),
        source: (0, model_1.normalizeModelSource)(record.source),
        lifecycleStatus: (0, model_1.normalizeModelLifecycleStatus)(record.lifecycleStatus),
        artifactForm: (0, model_1.normalizeModelArtifactForm)(record.artifactForm),
        provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(record.provider),
        modelId: normalizeOptionalText(record.modelId),
        localPath: normalizeOptionalText(record.localPath),
        createdAt: normalizeRequiredText(record.createdAt, "createdAt"),
        updatedAt: normalizeOptionalText(record.updatedAt),
        taskTags: (0, model_1.normalizeModelTaskTags)(record.taskTags),
        inferenceMode: typeof record.inferenceMode === "string"
            ? (0, model_inference_mode_1.normalizeModelInferenceMode)(record.inferenceMode)
            : undefined,
        serializationFormat: typeof record.serializationFormat === "string"
            ? (0, model_1.normalizeModelSerializationFormat)(record.serializationFormat)
            : undefined,
        parameterCount: normalizeOptionalNonNegativeNumber(record.parameterCount),
        sizeBytes: normalizeOptionalNonNegativeNumber(record.sizeBytes),
        baseModelId: normalizeOptionalText(record.baseModelId),
        generatedFromRunId: normalizeOptionalText(record.generatedFromRunId),
        adapterOfModelId: normalizeOptionalText(record.adapterOfModelId),
        backingArtifactIds: normalizeOptionalTextList(record.backingArtifactIds),
        primaryArtifactId: normalizeOptionalText(record.primaryArtifactId),
        validationStatus: typeof record.validationStatus === "string"
            ? (0, model_validation_1.normalizeModelValidationStatus)(record.validationStatus)
            : undefined,
        validationReportPath: normalizeOptionalText(record.validationReportPath),
        published: normalizePublishedSummary(record.published),
        metadata: record.metadata,
    };
}
