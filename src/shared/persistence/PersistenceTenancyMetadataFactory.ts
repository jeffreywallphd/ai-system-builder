import {
  PersistenceTenancyScopes,
  type PersistenceTenancyMetadata,
} from "../dto/persistence/PersistenceBoundaryDtos";
import { normalizePersistenceIdentifierToken } from "./PersistenceIdentifiers";

export function createPlatformTenancyMetadata(): PersistenceTenancyMetadata {
  return Object.freeze({
    scope: PersistenceTenancyScopes.platform,
  });
}

export function createWorkspaceTenancyMetadata(workspaceId: string): PersistenceTenancyMetadata {
  return Object.freeze({
    scope: PersistenceTenancyScopes.workspace,
    workspaceId: normalizePersistenceIdentifierToken(workspaceId, "workspaceId"),
  });
}

export function createUserTenancyMetadata(userIdentityId: string): PersistenceTenancyMetadata {
  return Object.freeze({
    scope: PersistenceTenancyScopes.user,
    userIdentityId: normalizePersistenceIdentifierToken(userIdentityId, "userIdentityId"),
  });
}

export function createNodeTenancyMetadata(nodeId: string): PersistenceTenancyMetadata {
  return Object.freeze({
    scope: PersistenceTenancyScopes.node,
    nodeId: normalizePersistenceIdentifierToken(nodeId, "nodeId"),
  });
}

export function createMixedTenancyMetadata(input: {
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly nodeId?: string;
}): PersistenceTenancyMetadata {
  const workspaceId = input.workspaceId?.trim()
    ? normalizePersistenceIdentifierToken(input.workspaceId, "workspaceId")
    : undefined;
  const userIdentityId = input.userIdentityId?.trim()
    ? normalizePersistenceIdentifierToken(input.userIdentityId, "userIdentityId")
    : undefined;
  const nodeId = input.nodeId?.trim()
    ? normalizePersistenceIdentifierToken(input.nodeId, "nodeId")
    : undefined;

  return Object.freeze({
    scope: PersistenceTenancyScopes.mixed,
    workspaceId,
    userIdentityId,
    nodeId,
  });
}
