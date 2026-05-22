"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_STATUSES = void 0;
exports.isWorkspaceStatus = isWorkspaceStatus;
exports.normalizeWorkspaceStatus = normalizeWorkspaceStatus;
exports.WORKSPACE_STATUSES = ["active", "archived", "deleting"];
function isWorkspaceStatus(value) {
    return exports.WORKSPACE_STATUSES.includes(value);
}
function normalizeWorkspaceStatus(value) {
    var normalized = value.trim().toLowerCase();
    if (!isWorkspaceStatus(normalized)) {
        throw new Error("Workspace status must be one of ".concat(exports.WORKSPACE_STATUSES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
