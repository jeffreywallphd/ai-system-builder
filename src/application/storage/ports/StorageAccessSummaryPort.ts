import type {
  StorageAccessMode,
  StorageAccessScope,
  StorageManagedAction,
  StoragePolicyRestrictedCapability,
} from "@domain/storage/StorageDomain";

export const StoragePermissionDecisionEffects = Object.freeze({
  allowed: "allowed",
  denied: "denied",
  restricted: "restricted",
  unknown: "unknown",
});

export type StoragePermissionDecisionEffect =
  typeof StoragePermissionDecisionEffects[keyof typeof StoragePermissionDecisionEffects];

export const StorageAccessSummarySources = Object.freeze({
  authorizationPolicy: "authorization-policy",
  ownershipDefault: "ownership-default",
  mixed: "mixed",
  unknown: "unknown",
});

export type StorageAccessSummarySource =
  typeof StorageAccessSummarySources[keyof typeof StorageAccessSummarySources];

export interface StorageAccessEffectivePermissionSummary {
  readonly action: StorageManagedAction;
  readonly effect: StoragePermissionDecisionEffect;
  readonly reasonCode?: string;
  readonly message?: string;
}

export interface StoragePolicyRestrictedCapabilitySummary {
  readonly capability: StoragePolicyRestrictedCapability;
  readonly restricted: boolean;
  readonly reasonCode?: string;
}

export interface StorageInstanceAccessSummary {
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
  readonly actorUserIdentityId?: string;
  readonly mode: StorageAccessMode;
  readonly scope: StorageAccessScope;
  readonly isOwner: boolean;
  readonly source: StorageAccessSummarySource;
  readonly effectivePermissions: ReadonlyArray<StorageAccessEffectivePermissionSummary>;
  readonly allowedActions: ReadonlyArray<StorageManagedAction>;
  readonly policyRestrictedCapabilities: ReadonlyArray<StoragePolicyRestrictedCapabilitySummary>;
}

