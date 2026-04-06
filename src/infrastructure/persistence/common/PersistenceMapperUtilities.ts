import type { PersistenceTenancyMetadata } from "../../../shared/dto/persistence/PersistenceBoundaryDtos";
import {
  createMixedTenancyMetadata,
  createNodeTenancyMetadata,
  createPlatformTenancyMetadata,
  createUserTenancyMetadata,
  createWorkspaceTenancyMetadata,
} from "../../../shared/persistence/PersistenceTenancyMetadataFactory";

export function normalizePersistenceLookup(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizePersistenceLookupLowercase(value: string | null | undefined): string | undefined {
  const normalized = normalizePersistenceLookup(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

export function parseOptionalPersistenceObjectJson(
  value: string | null | undefined,
  descriptor: string,
): Readonly<Record<string, unknown>> | undefined {
  const normalized = normalizePersistenceLookup(value);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("JSON payload must be an object.");
    }

    return Object.freeze({ ...(parsed as Record<string, unknown>) });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Persisted ${descriptor} JSON payload is invalid: ${details}`);
  }
}

export function createPersistenceTenancyMetadataFromLookup(input: {
  readonly workspaceId?: string | null;
  readonly userIdentityId?: string | null;
  readonly nodeId?: string | null;
}): PersistenceTenancyMetadata {
  const workspaceId = normalizePersistenceLookup(input.workspaceId);
  const userIdentityId = normalizePersistenceLookup(input.userIdentityId);
  const nodeId = normalizePersistenceLookup(input.nodeId);

  if (workspaceId && userIdentityId) {
    return createMixedTenancyMetadata({
      workspaceId,
      userIdentityId,
      nodeId,
    });
  }

  if (workspaceId) {
    return createWorkspaceTenancyMetadata(workspaceId);
  }

  if (userIdentityId) {
    return createUserTenancyMetadata(userIdentityId);
  }

  if (nodeId) {
    return createNodeTenancyMetadata(nodeId);
  }

  return createPlatformTenancyMetadata();
}

export function toPersistenceTenancyScopeFields(tenancy: PersistenceTenancyMetadata): {
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly nodeId?: string;
} {
  return Object.freeze({
    workspaceId: normalizePersistenceLookup(tenancy.workspaceId),
    userIdentityId: normalizePersistenceLookup(tenancy.userIdentityId),
    nodeId: normalizePersistenceLookup(tenancy.nodeId),
  });
}
