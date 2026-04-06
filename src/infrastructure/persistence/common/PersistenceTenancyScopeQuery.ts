import {
  normalizePersistenceLookup,
  normalizePersistenceLookupLowercase,
} from "./PersistenceMapperUtilities";
import type { SqliteWhereBuilder } from "./SqliteQueryHelpers";

export interface PersistenceTenancyScopeColumns {
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly nodeId?: string;
}

export interface PersistenceTenancyScopeFilter {
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly nodeId?: string;
}

export function applyTenancyScopeFilter(
  builder: SqliteWhereBuilder,
  scope: PersistenceTenancyScopeFilter,
  columns: PersistenceTenancyScopeColumns,
): void {
  if (columns.workspaceId) {
    builder.addEquals(columns.workspaceId, scope.workspaceId);
  }

  if (columns.userIdentityId) {
    builder.addEquals(columns.userIdentityId, scope.userIdentityId);
  }

  if (columns.nodeId) {
    builder.addEquals(columns.nodeId, scope.nodeId);
  }
}

export function normalizeWorkspaceTenancyLookup(value: string | null | undefined): string | undefined {
  return normalizePersistenceLookup(value);
}

export function normalizeUserTenancyLookup(value: string | null | undefined): string | undefined {
  return normalizePersistenceLookup(value);
}

export function normalizeNodeTenancyLookup(value: string | null | undefined): string | undefined {
  return normalizePersistenceLookup(value);
}

export function normalizeEmailTenancyLookup(value: string | null | undefined): string | undefined {
  return normalizePersistenceLookupLowercase(value);
}
