export const PersistenceTenancyScopes = Object.freeze({
  platform: "platform",
  workspace: "workspace",
  user: "user",
  node: "node",
  mixed: "mixed",
});

export type PersistenceTenancyScope =
  typeof PersistenceTenancyScopes[keyof typeof PersistenceTenancyScopes];

export interface PersistenceTenancyMetadata {
  readonly scope: PersistenceTenancyScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly nodeId?: string;
}

export interface PersistenceAuditStamp {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
}

export interface PersistenceVersionMetadata {
  readonly revision: number;
  readonly schemaVersion: number;
  readonly recordVersion?: number;
}

export const PersistenceSensitiveFieldProtections = Object.freeze({
  none: "none",
  hashed: "hashed",
  encrypted: "encrypted",
  tokenized: "tokenized",
  redacted: "redacted",
});

export type PersistenceSensitiveFieldProtection =
  typeof PersistenceSensitiveFieldProtections[keyof typeof PersistenceSensitiveFieldProtections];

export interface PersistenceSensitiveFieldDescriptor {
  readonly fieldPath: string;
  readonly protection: PersistenceSensitiveFieldProtection;
  readonly classification?: string;
  readonly keyReferenceId?: string;
}

export interface PersistenceMutationContext {
  readonly operationKey: string;
  readonly actorId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export function normalizePersistenceOperationKey(operationKey: string): string {
  const normalized = operationKey.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Persistence operationKey is required.");
  }
  return normalized;
}

export function toPersistenceTenancyLookupKey(tenancy: PersistenceTenancyMetadata): string {
  switch (tenancy.scope) {
    case PersistenceTenancyScopes.platform:
      return "platform";
    case PersistenceTenancyScopes.workspace:
      return `workspace:${tenancy.workspaceId ?? "unknown"}`;
    case PersistenceTenancyScopes.user:
      return `user:${tenancy.userIdentityId ?? "unknown"}`;
    case PersistenceTenancyScopes.node:
      return `node:${tenancy.nodeId ?? "unknown"}`;
    case PersistenceTenancyScopes.mixed:
      return [
        `workspace:${tenancy.workspaceId ?? "none"}`,
        `user:${tenancy.userIdentityId ?? "none"}`,
        `node:${tenancy.nodeId ?? "none"}`,
      ].join("|");
    default:
      return "unknown";
  }
}
