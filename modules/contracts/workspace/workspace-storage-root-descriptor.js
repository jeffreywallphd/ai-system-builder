"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_STORAGE_ROOT_KINDS = void 0;
exports.isWorkspaceStorageRootKind = isWorkspaceStorageRootKind;
exports.WORKSPACE_STORAGE_ROOT_KINDS = [
    "host-managed",
    "custom-local",
];
function isWorkspaceStorageRootKind(value) {
    return exports.WORKSPACE_STORAGE_ROOT_KINDS.includes(value);
}
