"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeModelId = normalizeModelId;
exports.normalizeModelIdentity = normalizeModelIdentity;
function normalizeModelId(value) {
    var normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error("Model id must be a non-empty trimmed string.");
    }
    return normalized;
}
function normalizeModelIdentity(identity) {
    return {
        provider: typeof identity.provider === "string" ? identity.provider.trim().toLowerCase() : undefined,
        modelId: normalizeModelId(identity.modelId),
    };
}
