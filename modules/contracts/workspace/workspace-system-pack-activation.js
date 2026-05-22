"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_DIAGNOSTIC_SEVERITIES = exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_STATUSES = void 0;
exports.isWorkspaceSystemPackActivationStatus = isWorkspaceSystemPackActivationStatus;
exports.isWorkspaceSystemPackActivationDiagnosticSeverity = isWorkspaceSystemPackActivationDiagnosticSeverity;
exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_STATUSES = [
    "active",
    "inactive",
    "failed",
];
exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_DIAGNOSTIC_SEVERITIES = [
    "info",
    "warning",
    "error",
];
function isWorkspaceSystemPackActivationStatus(value) {
    return exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_STATUSES.includes(value);
}
function isWorkspaceSystemPackActivationDiagnosticSeverity(value) {
    return exports.WORKSPACE_SYSTEM_PACK_ACTIVATION_DIAGNOSTIC_SEVERITIES.includes(value);
}
