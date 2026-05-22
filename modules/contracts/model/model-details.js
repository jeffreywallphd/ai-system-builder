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
exports.normalizeGetModelDetailsRequest = normalizeGetModelDetailsRequest;
exports.normalizeModelDetails = normalizeModelDetails;
exports.normalizeGetModelDetailsResult = normalizeGetModelDetailsResult;
var model_browse_provider_1 = require("./model-browse-provider");
var model_inference_mode_1 = require("./model-inference-mode");
var browse_models_1 = require("./browse-models");
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
function normalizeOptionalNonNegativeNumber(value) {
    if (typeof value !== "number") {
        return undefined;
    }
    return value >= 0 ? value : undefined;
}
function normalizeModelFileDescriptor(file) {
    var path = file.path.trim();
    if (path.length === 0) {
        throw new Error("Model file descriptor path must be a non-empty trimmed string.");
    }
    return {
        path: path,
        sizeBytes: normalizeOptionalNonNegativeNumber(file.sizeBytes),
        blobId: normalizeOptionalText(file.blobId),
        lfs: typeof file.lfs === "boolean" ? file.lfs : undefined,
    };
}
function normalizeModelFileDescriptors(files) {
    if (!files) {
        return undefined;
    }
    var normalized = files.map(function (file) { return normalizeModelFileDescriptor(file); });
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeGetModelDetailsRequest(request) {
    var modelId = request.modelId.trim();
    if (modelId.length === 0) {
        throw new Error("Get model details request modelId must be a non-empty trimmed string.");
    }
    return {
        provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider),
        modelId: modelId,
    };
}
function normalizeModelDetails(model) {
    var _a;
    var browseModel = (0, browse_models_1.normalizeModelBrowseItem)(model);
    var files = normalizeModelFileDescriptors(model.files);
    var siblings = (_a = normalizeStringList(model.siblings)) !== null && _a !== void 0 ? _a : files === null || files === void 0 ? void 0 : files.map(function (file) { return file.path; });
    return __assign(__assign({}, browseModel), { cardMarkdown: normalizeOptionalText(model.cardMarkdown), tags: normalizeStringList(model.tags), pipelineTag: normalizeOptionalText(model.pipelineTag), siblings: siblings, files: files, config: model.config, tokenizerAvailable: typeof model.tokenizerAvailable === "boolean" ? model.tokenizerAvailable : undefined, safetensorsAvailable: typeof model.safetensorsAvailable === "boolean" ? model.safetensorsAvailable : undefined, adapterAvailable: typeof model.adapterAvailable === "boolean" ? model.adapterAvailable : undefined, estimatedParameterCount: normalizeOptionalNonNegativeNumber(model.estimatedParameterCount), recommendedInferenceMode: typeof model.recommendedInferenceMode === "string"
            ? (0, model_inference_mode_1.normalizeModelInferenceMode)(model.recommendedInferenceMode)
            : undefined, warnings: normalizeStringList(model.warnings), metadata: model.metadata });
}
function normalizeGetModelDetailsResult(result) {
    return {
        model: normalizeModelDetails(result.model),
    };
}
