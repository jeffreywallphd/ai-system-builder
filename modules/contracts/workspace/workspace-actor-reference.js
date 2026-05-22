"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ACTOR_KINDS = void 0;
exports.isWorkspaceActorKind = isWorkspaceActorKind;
exports.WORKSPACE_ACTOR_KINDS = [
    "local-user",
    "system",
    "external-user",
];
function isWorkspaceActorKind(value) {
    return exports.WORKSPACE_ACTOR_KINDS.includes(value);
}
