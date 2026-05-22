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
exports.MAX_BROWSE_MODELS_LIMIT = exports.DEFAULT_BROWSE_MODELS_LIMIT = void 0;
exports.normalizeBrowseModelsRequest = normalizeBrowseModelsRequest;
exports.normalizeModelBrowseItem = normalizeModelBrowseItem;
exports.normalizeBrowseModelsResult = normalizeBrowseModelsResult;
var model_1 = require("../../domain/model");
var model_browse_provider_1 = require("./model-browse-provider");
var model_inference_mode_1 = require("./model-inference-mode");
exports.DEFAULT_BROWSE_MODELS_LIMIT = 25;
exports.MAX_BROWSE_MODELS_LIMIT = 100;
function normalizeOptionalText(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    var normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function normalizeOptionalNonNegativeNumber(value) {
    if (typeof value !== "number") {
        return undefined;
    }
    return value >= 0 ? value : undefined;
}
function normalizeBrowseLimit(limit) {
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
        return exports.DEFAULT_BROWSE_MODELS_LIMIT;
    }
    if (!Number.isInteger(limit) || limit <= 0) {
        return exports.DEFAULT_BROWSE_MODELS_LIMIT;
    }
    if (limit > exports.MAX_BROWSE_MODELS_LIMIT) {
        return exports.MAX_BROWSE_MODELS_LIMIT;
    }
    return limit;
}
function normalizeBrowseModelsRequest(request) {
    return {
        provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(request.provider),
        query: normalizeOptionalText(request.query),
        taskTags: (0, model_1.normalizeModelTaskTags)(request.taskTags),
        authorOrOrg: normalizeOptionalText(request.authorOrOrg),
        limit: normalizeBrowseLimit(request.limit),
        cursor: normalizeOptionalText(request.cursor),
        sort: request.sort,
        direction: request.direction,
    };
}
function normalizeModelBrowseItem(item) {
    var modelId = item.modelId.trim();
    var displayName = item.displayName.trim();
    if (modelId.length === 0) {
        throw new Error("Model browse item modelId must be a non-empty trimmed string.");
    }
    if (displayName.length === 0) {
        throw new Error("Model browse item displayName must be a non-empty trimmed string.");
    }
    return __assign(__assign({}, item), { provider: (0, model_browse_provider_1.normalizeModelBrowseProvider)(item.provider), modelId: modelId, displayName: displayName, authorOrOrg: normalizeOptionalText(item.authorOrOrg), description: normalizeOptionalText(item.description), taskTags: (0, model_1.normalizeModelTaskTags)(item.taskTags), downloads: normalizeOptionalNonNegativeNumber(item.downloads), likes: normalizeOptionalNonNegativeNumber(item.likes), license: normalizeOptionalText(item.license), lastModified: normalizeOptionalText(item.lastModified), inferenceMode: typeof item.inferenceMode === "string"
            ? (0, model_inference_mode_1.normalizeModelInferenceMode)(item.inferenceMode)
            : undefined, modelSizeLabel: normalizeOptionalText(item.modelSizeLabel), gated: typeof item.gated === "boolean" ? item.gated : undefined, private: typeof item.private === "boolean" ? item.private : undefined });
}
function normalizeBrowseModelsResult(result) {
    return {
        models: result.models.map(function (model) { return normalizeModelBrowseItem(model); }),
        nextCursor: normalizeOptionalText(result.nextCursor),
    };
}
