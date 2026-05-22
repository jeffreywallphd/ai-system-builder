"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ID_FORMAT_DESCRIPTION = exports.WORKSPACE_ID_MAX_LENGTH = void 0;
exports.isWorkspaceId = isWorkspaceId;
exports.createWorkspaceId = createWorkspaceId;
exports.WORKSPACE_ID_MAX_LENGTH = 96;
exports.WORKSPACE_ID_FORMAT_DESCRIPTION = "a non-empty, trimmed, URL-safe and persistence-key-safe string that is not a path, URL, drive-qualified location, shell-heavy value, or raw locator";
var WORKSPACE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
var CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
var SHELL_METACHARACTER_PATTERN = /[;&|`$<>*?()[\]{}'"!#~]/;
var URL_LIKE_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
var DRIVE_QUALIFIED_PATTERN = /^[a-zA-Z]:/;
var TOKEN_LIKE_PATTERN = /^(?:gh[pousr]_|github_pat_|sk-[a-zA-Z0-9]|xox[baprs]-|secret[_-]?|token[_-]?)/i;
function invalidWorkspaceIdMessage() {
    return "Workspace id must be ".concat(exports.WORKSPACE_ID_FORMAT_DESCRIPTION, ".");
}
function looksLikeUnsafePathUrlOrLocator(value) {
    return (value.includes("/") ||
        value.includes("\\") ||
        value.includes("..") ||
        value.startsWith(".") ||
        URL_LIKE_PATTERN.test(value) ||
        DRIVE_QUALIFIED_PATTERN.test(value) ||
        TOKEN_LIKE_PATTERN.test(value) ||
        CONTROL_CHARACTER_PATTERN.test(value) ||
        SHELL_METACHARACTER_PATTERN.test(value));
}
function isWorkspaceId(input) {
    if (typeof input !== "string") {
        return false;
    }
    var normalized = input.trim();
    return (normalized.length > 0 &&
        normalized.length <= exports.WORKSPACE_ID_MAX_LENGTH &&
        normalized === input &&
        WORKSPACE_ID_PATTERN.test(normalized) &&
        !looksLikeUnsafePathUrlOrLocator(normalized));
}
function createWorkspaceId(input) {
    var normalized = input.trim();
    if (!isWorkspaceId(normalized)) {
        var error = new Error(invalidWorkspaceIdMessage());
        error.stack = undefined;
        throw error;
    }
    return normalized;
}
