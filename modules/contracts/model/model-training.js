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
exports.MODEL_TRAINING_STATUSES = exports.MODEL_TRAINING_METHODS = void 0;
exports.normalizeModelTrainingRequest = normalizeModelTrainingRequest;
exports.normalizeModelTrainingResult = normalizeModelTrainingResult;
var workspace_1 = require("../workspace");
var model_1 = require("../../domain/model");
var model_browse_provider_1 = require("./model-browse-provider");
var model_inference_mode_1 = require("./model-inference-mode");
var model_inventory_1 = require("./model-inventory");
exports.MODEL_TRAINING_METHODS = ["lora", "qlora", "full-finetune"];
exports.MODEL_TRAINING_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"];
var MODEL_TRAINING_METHOD_SET = new Set(exports.MODEL_TRAINING_METHODS);
var MODEL_TRAINING_STATUS_SET = new Set(exports.MODEL_TRAINING_STATUSES);
var DATASET_SPLIT_ROLE_SET = new Set(["train", "validation", "test"]);
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
function normalizeOptionalNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function normalizeOptionalInteger(value) {
    return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
function normalizeOptionalStringList(value) {
    if (!value) {
        return undefined;
    }
    var normalized = value.map(function (entry) { return entry.trim(); }).filter(function (entry) { return entry.length > 0; });
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeTrainingMethod(value) {
    var normalized = value.trim().toLowerCase();
    if (!MODEL_TRAINING_METHOD_SET.has(normalized)) {
        throw new Error("Training method must be one of: ".concat(exports.MODEL_TRAINING_METHODS.join(", "), ". Received: ").concat(value));
    }
    return normalized;
}
function normalizeTrainingStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!MODEL_TRAINING_STATUS_SET.has(normalized)) {
        throw new Error("Training status must be one of: ".concat(exports.MODEL_TRAINING_STATUSES.join(", "), ". Received: ").concat(value));
    }
    return normalized;
}
function normalizeDatasetSplitRole(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim().toLowerCase();
    if (!DATASET_SPLIT_ROLE_SET.has(normalized)) {
        throw new Error("Dataset splitRole must be one of: train, validation, test. Received: ".concat(value));
    }
    return normalized;
}
function normalizeModelTrainingRequest(request) {
    var datasets = request.datasets.map(function (dataset, index) { return ({
        artifactId: normalizeRequiredText(dataset.artifactId, "datasets[".concat(index, "].artifactId")),
        splitRole: normalizeDatasetSplitRole(dataset.splitRole),
        format: normalizeOptionalText(dataset.format),
        path: normalizeOptionalText(dataset.path),
    }); });
    if (datasets.length === 0) {
        throw new Error("Model training requires at least one dataset input.");
    }
    return {
        workspaceId: request.workspaceId ? (0, workspace_1.createWorkspaceId)(request.workspaceId) : undefined,
        baseModel: {
            modelRecordId: normalizeOptionalText(request.baseModel.modelRecordId),
            provider: typeof request.baseModel.provider === "string" ? (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.baseModel.provider) : undefined,
            modelId: normalizeOptionalText(request.baseModel.modelId),
            localPath: normalizeOptionalText(request.baseModel.localPath),
            inferenceMode: typeof request.baseModel.inferenceMode === "string"
                ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.baseModel.inferenceMode)
                : undefined,
        },
        datasets: datasets,
        method: normalizeTrainingMethod(request.method),
        commonParameters: {
            numEpochs: normalizeOptionalInteger(request.commonParameters.numEpochs),
            maxSteps: normalizeOptionalInteger(request.commonParameters.maxSteps),
            batchSize: normalizeOptionalInteger(request.commonParameters.batchSize),
            learningRate: normalizeOptionalNumber(request.commonParameters.learningRate),
            weightDecay: normalizeOptionalNumber(request.commonParameters.weightDecay),
            maxSequenceLength: normalizeOptionalInteger(request.commonParameters.maxSequenceLength),
            seed: normalizeOptionalInteger(request.commonParameters.seed),
        },
        advancedParameters: request.advancedParameters
            ? {
                gradientAccumulationSteps: normalizeOptionalInteger(request.advancedParameters.gradientAccumulationSteps),
                warmupSteps: normalizeOptionalInteger(request.advancedParameters.warmupSteps),
                warmupRatio: normalizeOptionalNumber(request.advancedParameters.warmupRatio),
                schedulerType: normalizeOptionalText(request.advancedParameters.schedulerType),
                evalIntervalSteps: normalizeOptionalInteger(request.advancedParameters.evalIntervalSteps),
                checkpointIntervalSteps: normalizeOptionalInteger(request.advancedParameters.checkpointIntervalSteps),
                saveTotalLimit: normalizeOptionalInteger(request.advancedParameters.saveTotalLimit),
                mixedPrecision: request.advancedParameters.mixedPrecision,
                gradientCheckpointing: request.advancedParameters.gradientCheckpointing === true,
                lora: request.advancedParameters.lora
                    ? {
                        rank: normalizeOptionalInteger(request.advancedParameters.lora.rank),
                        alpha: normalizeOptionalNumber(request.advancedParameters.lora.alpha),
                        dropout: normalizeOptionalNumber(request.advancedParameters.lora.dropout),
                        targetModules: normalizeOptionalStringList(request.advancedParameters.lora.targetModules),
                    }
                    : undefined,
                quantization: request.advancedParameters.quantization
                    ? {
                        loadIn4Bit: request.advancedParameters.quantization.loadIn4Bit === true,
                        loadIn8Bit: request.advancedParameters.quantization.loadIn8Bit === true,
                        bnb4BitQuantType: normalizeOptionalText(request.advancedParameters.quantization.bnb4BitQuantType),
                        bnb4BitComputeDtype: normalizeOptionalText(request.advancedParameters.quantization.bnb4BitComputeDtype),
                    }
                    : undefined,
            }
            : undefined,
        output: {
            outputModelName: normalizeRequiredText(request.output.outputModelName, "output.outputModelName"),
            localOutputDirectory: normalizeOptionalText(request.output.localOutputDirectory),
            maxShardSize: normalizeOptionalText(request.output.maxShardSize),
            destination: {
                local: {
                    enabled: request.output.destination.local.enabled === true,
                },
                huggingFace: request.output.destination.huggingFace
                    ? {
                        enabled: request.output.destination.huggingFace.enabled === true,
                        provider: request.output.destination.huggingFace.provider,
                        repository: normalizeOptionalText(request.output.destination.huggingFace.repository),
                        revision: normalizeOptionalText(request.output.destination.huggingFace.revision),
                        pathPrefix: normalizeOptionalText(request.output.destination.huggingFace.pathPrefix),
                        private: request.output.destination.huggingFace.private === true,
                    }
                    : undefined,
            },
            registration: request.output.registration
                ? {
                    displayName: normalizeOptionalText(request.output.registration.displayName),
                    artifactForm: request.output.registration.artifactForm,
                    inferenceMode: typeof request.output.registration.inferenceMode === "string"
                        ? (0, model_inference_mode_1.normalizeModelInferenceMode)(request.output.registration.inferenceMode)
                        : undefined,
                    taskTags: (0, model_1.normalizeModelTaskTags)(request.output.registration.taskTags),
                    baseModelId: normalizeOptionalText(request.output.registration.baseModelId),
                    adapterOfModelId: normalizeOptionalText(request.output.registration.adapterOfModelId),
                    metadata: request.output.registration.metadata,
                }
                : undefined,
        },
        validation: request.validation
            ? {
                enabled: request.validation.enabled === true,
                expectedLoRA: request.validation.expectedLoRA === true,
                expectedRecurrentAdditions: request.validation.expectedRecurrentAdditions === true,
                taskTags: (0, model_1.normalizeModelTaskTags)(request.validation.taskTags),
            }
            : undefined,
        runtimeMetadata: request.runtimeMetadata,
    };
}
function normalizeModelTrainingResult(result) {
    var _a;
    return __assign(__assign({}, result), { runId: normalizeRequiredText(result.runId, "runId"), status: normalizeTrainingStatus(result.status), progress: result.progress
            ? {
                stage: normalizeOptionalText(result.progress.stage),
                message: normalizeOptionalText(result.progress.message),
                epoch: normalizeOptionalInteger(result.progress.epoch),
                totalEpochs: normalizeOptionalInteger(result.progress.totalEpochs),
                batch: normalizeOptionalInteger(result.progress.batch),
                totalBatches: normalizeOptionalInteger(result.progress.totalBatches),
            }
            : undefined, outputDirectory: normalizeOptionalText(result.outputDirectory), outputModelName: normalizeOptionalText(result.outputModelName), outputModel: result.outputModel ? (0, model_inventory_1.normalizeModelInventoryRecord)(result.outputModel) : undefined, generatedModelCandidate: result.generatedModelCandidate
            ? {
                displayName: normalizeRequiredText(result.generatedModelCandidate.displayName, "generatedModelCandidate.displayName"),
                provider: typeof result.generatedModelCandidate.provider === "string"
                    ? (0, model_browse_provider_1.normalizeModelBrowseProvider)(result.generatedModelCandidate.provider)
                    : undefined,
                modelId: normalizeOptionalText(result.generatedModelCandidate.modelId),
                localPath: normalizeOptionalText(result.generatedModelCandidate.localPath),
                artifactForm: result.generatedModelCandidate.artifactForm,
                inferenceMode: typeof result.generatedModelCandidate.inferenceMode === "string"
                    ? (0, model_inference_mode_1.normalizeModelInferenceMode)(result.generatedModelCandidate.inferenceMode)
                    : undefined,
                taskTags: (0, model_1.normalizeModelTaskTags)(result.generatedModelCandidate.taskTags),
                baseModelId: normalizeOptionalText(result.generatedModelCandidate.baseModelId),
                adapterOfModelId: normalizeOptionalText(result.generatedModelCandidate.adapterOfModelId),
                generatedFromRunId: normalizeOptionalText(result.generatedModelCandidate.generatedFromRunId),
                serializationFormat: normalizeOptionalText(result.generatedModelCandidate.serializationFormat),
                sizeBytes: normalizeOptionalNumber(result.generatedModelCandidate.sizeBytes),
                metadata: result.generatedModelCandidate.metadata,
            }
            : undefined, checkpoints: (_a = result.checkpoints) === null || _a === void 0 ? void 0 : _a.map(function (checkpoint) { return ({
            path: normalizeRequiredText(checkpoint.path, "checkpoint.path"),
            step: normalizeOptionalInteger(checkpoint.step),
            metric: normalizeOptionalText(checkpoint.metric),
            value: normalizeOptionalNumber(checkpoint.value),
        }); }), logs: normalizeOptionalStringList(result.logs), warnings: normalizeOptionalStringList(result.warnings), validationReportPath: normalizeOptionalText(result.validationReportPath), error: result.error
            ? {
                code: normalizeRequiredText(result.error.code, "error.code"),
                message: normalizeRequiredText(result.error.message, "error.message"),
                details: result.error.details,
            }
            : undefined });
}
