"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOST_CONTEXT_METADATA_FORMAT_DESCRIPTION = void 0;
exports.normalizeHostContextMetadata = normalizeHostContextMetadata;
exports.createHostContext = createHostContext;
var host_identity_1 = require("./host-identity");
var HOST_CONTEXT_NON_GOAL_KEYWORDS = [
    "auth",
    "session",
    "request",
    "response",
    "window",
    "framework",
    "electron",
    "express",
];
exports.HOST_CONTEXT_METADATA_FORMAT_DESCRIPTION = "a plain object containing JSON-serializable values and no auth/session/request/window/framework semantics";
function invalidHostContextMetadataMessage(reason) {
    return "Host context metadata must be ".concat(exports.HOST_CONTEXT_METADATA_FORMAT_DESCRIPTION, ". ").concat(reason);
}
function hasNonGoalKeyword(key) {
    var normalized = key.trim().toLowerCase();
    return HOST_CONTEXT_NON_GOAL_KEYWORDS.some(function (keyword) {
        return normalized.includes(keyword);
    });
}
function isPlainObject(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function normalizeMetadataValue(value, path) {
    if (value === null) {
        return value;
    }
    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(function (entry, index) {
            return normalizeMetadataValue(entry, "".concat(path, "[").concat(index, "]"));
        });
    }
    if (!isPlainObject(value)) {
        throw new Error(invalidHostContextMetadataMessage("Received non-plain object at \"".concat(path, "\".")));
    }
    var normalizedEntries = Object.entries(value).map(function (_a) {
        var entryKey = _a[0], entry = _a[1];
        var normalizedKey = entryKey.trim();
        if (!normalizedKey) {
            throw new Error(invalidHostContextMetadataMessage("Received an empty metadata key at \"".concat(path, "\".")));
        }
        if (hasNonGoalKeyword(normalizedKey)) {
            throw new Error(invalidHostContextMetadataMessage("Metadata key \"".concat(normalizedKey, "\" introduces a non-goal semantic.")));
        }
        return [
            normalizedKey,
            normalizeMetadataValue(entry, "".concat(path, ".").concat(normalizedKey)),
        ];
    });
    return Object.fromEntries(normalizedEntries);
}
function normalizeHostContextMetadata(metadata) {
    if (metadata === undefined) {
        return undefined;
    }
    if (!isPlainObject(metadata)) {
        throw new Error(invalidHostContextMetadataMessage("Received non-object root metadata."));
    }
    return normalizeMetadataValue(metadata, "metadata");
}
function createHostContext(host, options) {
    var resolvedHost = typeof host === "string"
        ? (0, host_identity_1.createHostIdentity)(host, { id: options === null || options === void 0 ? void 0 : options.hostId })
        : (0, host_identity_1.createHostIdentity)(host.kind, { id: host.id });
    return {
        host: resolvedHost,
        requestId: options === null || options === void 0 ? void 0 : options.requestId,
        correlationId: options === null || options === void 0 ? void 0 : options.correlationId,
        metadata: normalizeHostContextMetadata(options === null || options === void 0 ? void 0 : options.metadata),
    };
}
