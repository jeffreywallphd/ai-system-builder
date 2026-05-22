"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePublishModelRequest = normalizePublishModelRequest;
var workspace_1 = require("../workspace");
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
function normalizeRequiredWorkspaceId(value) {
    if (typeof value !== "string") {
        throw new Error("workspaceId must be provided for workspace-scoped model operations.");
    }
    return (0, workspace_1.createWorkspaceId)(value);
}
function normalizePublishModelRequest(request) {
    return {
        workspaceId: normalizeRequiredWorkspaceId(request.workspaceId),
        modelRecordId: normalizeRequiredText(request.modelRecordId, "modelRecordId"),
        repository: normalizeRequiredText(request.repository, "repository"),
        owner: normalizeOptionalText(request.owner),
        revision: normalizeOptionalText(request.revision),
        private: typeof request.private === "boolean" ? request.private : undefined,
        pathPrefix: normalizeOptionalText(request.pathPrefix),
        token: normalizeOptionalText(request.token),
        allowWarningValidation: typeof request.allowWarningValidation === "boolean" ? request.allowWarningValidation : undefined,
        allowInvalidValidation: typeof request.allowInvalidValidation === "boolean" ? request.allowInvalidValidation : undefined,
        allowInvalid: typeof request.allowInvalid === "boolean" ? request.allowInvalid : undefined,
        forceRevalidate: typeof request.forceRevalidate === "boolean" ? request.forceRevalidate : undefined,
    };
}
