"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROLES = void 0;
exports.isWorkspaceRole = isWorkspaceRole;
exports.normalizeWorkspaceRole = normalizeWorkspaceRole;
exports.WORKSPACE_ROLES = ["owner", "admin", "member"];
function isWorkspaceRole(value) {
    return exports.WORKSPACE_ROLES.includes(value);
}
function normalizeWorkspaceRole(value) {
    var normalized = value.trim().toLowerCase();
    if (!isWorkspaceRole(normalized)) {
        throw new Error("Workspace role must be one of ".concat(exports.WORKSPACE_ROLES.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
