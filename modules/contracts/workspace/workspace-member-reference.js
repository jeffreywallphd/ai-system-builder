"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_MEMBER_STATUSES = void 0;
exports.isWorkspaceMemberStatus = isWorkspaceMemberStatus;
exports.WORKSPACE_MEMBER_STATUSES = ["active", "removed"];
function isWorkspaceMemberStatus(value) {
    return exports.WORKSPACE_MEMBER_STATUSES.includes(value);
}
