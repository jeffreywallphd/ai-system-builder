import { type WorkspaceVisibility, WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

export class OfflineLocalModeDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineLocalModeDomainError";
  }
}

export const OfflineAuthorityScopes = Object.freeze({
  authoritativeServer: "authoritative-server",
  localDraft: "local-draft",
  localEphemeral: "local-ephemeral",
});

export type OfflineAuthorityScope = typeof OfflineAuthorityScopes[keyof typeof OfflineAuthorityScopes];

export const OfflineStorageBuckets = Object.freeze({
  offlineCache: "offline-cache",
  localDraftState: "local-draft-state",
  mutationQueue: "mutation-queue",
  localEphemeralState: "local-ephemeral-state",
  serverAuthoritativeOnly: "server-authoritative-only",
});

export type OfflineStorageBucket = typeof OfflineStorageBuckets[keyof typeof OfflineStorageBuckets];

export const OfflineResourceClasses = Object.freeze({
  workspaceCatalog: "workspace-catalog",
  workflowDefinition: "workflow-definition",
  workflowDraft: "workflow-draft",
  runSubmissionIntent: "run-submission-intent",
  localRuntimeSession: "local-runtime-session",
  secretPlaintextMaterial: "secret-plaintext-material",
});

export type OfflineResourceClass = typeof OfflineResourceClasses[keyof typeof OfflineResourceClasses];

export const OfflineProhibitedPatterns = Object.freeze({
  silentGlobalDivergence: "silent-global-divergence",
  localCacheAsGlobalAuthority: "local-cache-as-global-authority",
  unsignaledAuthoritativeOverwrite: "unsignaled-authoritative-overwrite",
});

export type OfflineProhibitedPattern =
  typeof OfflineProhibitedPatterns[keyof typeof OfflineProhibitedPatterns];

export interface OfflineCapabilityMatrix {
  readonly cache: boolean;
  readonly view: boolean;
  readonly edit: boolean;
  readonly queueMutation: boolean;
  readonly execute: boolean;
}

export interface OfflineResourceAuthorityBoundary {
  readonly resourceClass: OfflineResourceClass;
  readonly authoritativeStateScope: OfflineAuthorityScope;
  readonly defaultStorageBucket: OfflineStorageBucket;
  readonly offlineCapabilities: OfflineCapabilityMatrix;
  readonly eligibility: OfflineResourceEligibilityMetadata;
  readonly reconnectionPolicy: string;
  readonly prohibitedPatterns: ReadonlyArray<OfflineProhibitedPattern>;
}

export const OfflineResourceBehaviorClasses = Object.freeze({
  cachedReadOnly: "cached-read-only",
  localDraft: "local-draft",
  queuedAuthoritativeIntent: "queued-authoritative-intent",
  localEphemeralExecution: "local-ephemeral-execution",
  serverOnly: "server-only",
});

export type OfflineResourceBehaviorClass =
  typeof OfflineResourceBehaviorClasses[keyof typeof OfflineResourceBehaviorClasses];

export const OfflineWorkspaceAccessRoles = Object.freeze({
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
});

export type OfflineWorkspaceAccessRole =
  typeof OfflineWorkspaceAccessRoles[keyof typeof OfflineWorkspaceAccessRoles];

export const OfflineWorkspaceSharingPostures = Object.freeze({
  workspaceOnly: "workspace-only",
  tenantWide: "tenant-wide",
  externalShared: "external-shared",
  publicLink: "public-link",
});

export type OfflineWorkspaceSharingPosture =
  typeof OfflineWorkspaceSharingPostures[keyof typeof OfflineWorkspaceSharingPostures];

export const OfflineSensitivityMarkings = Object.freeze({
  standard: "standard",
  sensitive: "sensitive",
  restricted: "restricted",
  secret: "secret",
});

export type OfflineSensitivityMarking =
  typeof OfflineSensitivityMarkings[keyof typeof OfflineSensitivityMarkings];

export const OfflineStorageRules = Object.freeze({
  allowOfflineCache: "allow-offline-cache",
  requireEncryptedOfflineCache: "require-encrypted-offline-cache",
  disallowOfflineCache: "disallow-offline-cache",
});

export type OfflineStorageRule = typeof OfflineStorageRules[keyof typeof OfflineStorageRules];

export const OfflineDeviceTrustPostures = Object.freeze({
  trusted: "trusted",
  pendingVerification: "pending-verification",
  untrusted: "untrusted",
  revoked: "revoked",
});

export type OfflineDeviceTrustPosture =
  typeof OfflineDeviceTrustPostures[keyof typeof OfflineDeviceTrustPostures];

export interface OfflineResourceEligibilityMetadata {
  readonly behaviorClass: OfflineResourceBehaviorClass;
  readonly supportsOffline: boolean;
  readonly maxSensitivityAllowed: OfflineSensitivityMarking;
  readonly requiresTrustedDeviceForEdit: boolean;
  readonly requiresTrustedDeviceForQueueMutation: boolean;
  readonly requiresTrustedDeviceForExecute: boolean;
  readonly allowPublicWorkspaceOfflineRead: boolean;
  readonly allowExternalSharingOfflineEdit: boolean;
}

export interface OfflineResourcePolicyEvaluationInput {
  readonly workspaceVisibility: WorkspaceVisibility;
  readonly workspaceAccessRole: OfflineWorkspaceAccessRole;
  readonly workspaceSharingPosture: OfflineWorkspaceSharingPosture;
  readonly sensitivityMarking: OfflineSensitivityMarking;
  readonly storageRule: OfflineStorageRule;
  readonly deviceTrustPosture: OfflineDeviceTrustPosture;
}

export interface OfflineResourceOperationDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface OfflineResourceOperationPolicyMatrix {
  readonly cache: OfflineResourceOperationDecision;
  readonly read: OfflineResourceOperationDecision;
  readonly edit: OfflineResourceOperationDecision;
  readonly queueMutation: OfflineResourceOperationDecision;
  readonly execute: OfflineResourceOperationDecision;
}

export interface OfflineResourcePolicyEvaluation {
  readonly resourceClass: string;
  readonly supportedResourceClass: boolean;
  readonly authoritativeStateScope?: OfflineAuthorityScope;
  readonly defaultStorageBucket?: OfflineStorageBucket;
  readonly behaviorClass?: OfflineResourceBehaviorClass;
  readonly posture: OfflineResourceOperationPolicyMatrix;
  readonly exclusionReasons: ReadonlyArray<string>;
}

const OfflineSensitivityRank: Readonly<Record<OfflineSensitivityMarking, number>> = Object.freeze({
  [OfflineSensitivityMarkings.standard]: 0,
  [OfflineSensitivityMarkings.sensitive]: 1,
  [OfflineSensitivityMarkings.restricted]: 2,
  [OfflineSensitivityMarkings.secret]: 3,
});

const OfflineResourceBoundaryCatalog: Readonly<Record<OfflineResourceClass, OfflineResourceAuthorityBoundary>> =
  Object.freeze({
    [OfflineResourceClasses.workspaceCatalog]: Object.freeze({
      resourceClass: OfflineResourceClasses.workspaceCatalog,
      authoritativeStateScope: OfflineAuthorityScopes.authoritativeServer,
      defaultStorageBucket: OfflineStorageBuckets.offlineCache,
      offlineCapabilities: Object.freeze({
        cache: true,
        view: true,
        edit: false,
        queueMutation: false,
        execute: false,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.cachedReadOnly,
        supportsOffline: true,
        maxSensitivityAllowed: OfflineSensitivityMarkings.restricted,
        requiresTrustedDeviceForEdit: false,
        requiresTrustedDeviceForQueueMutation: false,
        requiresTrustedDeviceForExecute: false,
        allowPublicWorkspaceOfflineRead: true,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Refresh from authoritative server before showing stale-sensitive tenancy or policy metadata.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.silentGlobalDivergence,
        OfflineProhibitedPatterns.localCacheAsGlobalAuthority,
      ]),
    }),
    [OfflineResourceClasses.workflowDefinition]: Object.freeze({
      resourceClass: OfflineResourceClasses.workflowDefinition,
      authoritativeStateScope: OfflineAuthorityScopes.authoritativeServer,
      defaultStorageBucket: OfflineStorageBuckets.offlineCache,
      offlineCapabilities: Object.freeze({
        cache: true,
        view: true,
        edit: false,
        queueMutation: false,
        execute: false,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.cachedReadOnly,
        supportsOffline: true,
        maxSensitivityAllowed: OfflineSensitivityMarkings.sensitive,
        requiresTrustedDeviceForEdit: false,
        requiresTrustedDeviceForQueueMutation: false,
        requiresTrustedDeviceForExecute: false,
        allowPublicWorkspaceOfflineRead: true,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Treat cached workflow definitions as read-only snapshots and revalidate revision before authoritative write attempts.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.silentGlobalDivergence,
        OfflineProhibitedPatterns.localCacheAsGlobalAuthority,
      ]),
    }),
    [OfflineResourceClasses.workflowDraft]: Object.freeze({
      resourceClass: OfflineResourceClasses.workflowDraft,
      authoritativeStateScope: OfflineAuthorityScopes.localDraft,
      defaultStorageBucket: OfflineStorageBuckets.localDraftState,
      offlineCapabilities: Object.freeze({
        cache: true,
        view: true,
        edit: true,
        queueMutation: true,
        execute: false,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.localDraft,
        supportsOffline: true,
        maxSensitivityAllowed: OfflineSensitivityMarkings.restricted,
        requiresTrustedDeviceForEdit: true,
        requiresTrustedDeviceForQueueMutation: true,
        requiresTrustedDeviceForExecute: false,
        allowPublicWorkspaceOfflineRead: false,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Local drafts remain local-only until explicit promote operation creates a visible sync mutation envelope.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.silentGlobalDivergence,
        OfflineProhibitedPatterns.unsignaledAuthoritativeOverwrite,
      ]),
    }),
    [OfflineResourceClasses.runSubmissionIntent]: Object.freeze({
      resourceClass: OfflineResourceClasses.runSubmissionIntent,
      authoritativeStateScope: OfflineAuthorityScopes.authoritativeServer,
      defaultStorageBucket: OfflineStorageBuckets.mutationQueue,
      offlineCapabilities: Object.freeze({
        cache: true,
        view: true,
        edit: true,
        queueMutation: true,
        execute: false,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.queuedAuthoritativeIntent,
        supportsOffline: true,
        maxSensitivityAllowed: OfflineSensitivityMarkings.sensitive,
        requiresTrustedDeviceForEdit: true,
        requiresTrustedDeviceForQueueMutation: true,
        requiresTrustedDeviceForExecute: false,
        allowPublicWorkspaceOfflineRead: false,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Queued run intents require authoritative acceptance/rejection on reconnect and cannot self-mark as globally accepted.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.silentGlobalDivergence,
        OfflineProhibitedPatterns.unsignaledAuthoritativeOverwrite,
      ]),
    }),
    [OfflineResourceClasses.localRuntimeSession]: Object.freeze({
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      authoritativeStateScope: OfflineAuthorityScopes.localEphemeral,
      defaultStorageBucket: OfflineStorageBuckets.localEphemeralState,
      offlineCapabilities: Object.freeze({
        cache: true,
        view: true,
        edit: true,
        queueMutation: false,
        execute: true,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.localEphemeralExecution,
        supportsOffline: true,
        maxSensitivityAllowed: OfflineSensitivityMarkings.sensitive,
        requiresTrustedDeviceForEdit: true,
        requiresTrustedDeviceForQueueMutation: false,
        requiresTrustedDeviceForExecute: true,
        allowPublicWorkspaceOfflineRead: false,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Local runtime sessions can continue locally but never claim authoritative control-plane run truth.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.localCacheAsGlobalAuthority,
      ]),
    }),
    [OfflineResourceClasses.secretPlaintextMaterial]: Object.freeze({
      resourceClass: OfflineResourceClasses.secretPlaintextMaterial,
      authoritativeStateScope: OfflineAuthorityScopes.authoritativeServer,
      defaultStorageBucket: OfflineStorageBuckets.serverAuthoritativeOnly,
      offlineCapabilities: Object.freeze({
        cache: false,
        view: false,
        edit: false,
        queueMutation: false,
        execute: false,
      }),
      eligibility: Object.freeze({
        behaviorClass: OfflineResourceBehaviorClasses.serverOnly,
        supportsOffline: false,
        maxSensitivityAllowed: OfflineSensitivityMarkings.standard,
        requiresTrustedDeviceForEdit: true,
        requiresTrustedDeviceForQueueMutation: true,
        requiresTrustedDeviceForExecute: true,
        allowPublicWorkspaceOfflineRead: false,
        allowExternalSharingOfflineEdit: false,
      }),
      reconnectionPolicy:
        "Plaintext secret material stays non-cacheable and must be resolved through policy-checked online retrieval flows.",
      prohibitedPatterns: Object.freeze([
        OfflineProhibitedPatterns.localCacheAsGlobalAuthority,
      ]),
    }),
  });

export function listOfflineResourceAuthorityBoundaries(): ReadonlyArray<OfflineResourceAuthorityBoundary> {
  return Object.freeze(Object.values(OfflineResourceBoundaryCatalog));
}

export interface OfflineResourceEligibilityPolicyEntry {
  readonly resourceClass: OfflineResourceClass;
  readonly authorityScope: OfflineAuthorityScope;
  readonly defaultStorageBucket: OfflineStorageBucket;
  readonly behaviorClass: OfflineResourceBehaviorClass;
  readonly supportsOffline: boolean;
  readonly offlineCapabilities: OfflineCapabilityMatrix;
}

export function listOfflineResourceEligibilityPolicies(): ReadonlyArray<OfflineResourceEligibilityPolicyEntry> {
  return Object.freeze(
    Object.values(OfflineResourceBoundaryCatalog).map((boundary) => Object.freeze({
      resourceClass: boundary.resourceClass,
      authorityScope: boundary.authoritativeStateScope,
      defaultStorageBucket: boundary.defaultStorageBucket,
      behaviorClass: boundary.eligibility.behaviorClass,
      supportsOffline: boundary.eligibility.supportsOffline,
      offlineCapabilities: boundary.offlineCapabilities,
    })),
  );
}

export function resolveOfflineResourceAuthorityBoundary(
  resourceClass: OfflineResourceClass,
): OfflineResourceAuthorityBoundary {
  const boundary = OfflineResourceBoundaryCatalog[resourceClass];
  if (!boundary) {
    throw new OfflineLocalModeDomainError(
      `Offline resource class '${String(resourceClass)}' is not registered in the authority catalog.`,
    );
  }
  return boundary;
}

function resolveOfflineResourceAuthorityBoundaryIfSupported(resourceClass: string): OfflineResourceAuthorityBoundary | undefined {
  const byClass = OfflineResourceBoundaryCatalog as Record<string, OfflineResourceAuthorityBoundary | undefined>;
  return byClass[resourceClass];
}

function normalizeWorkspaceAccessRole(value: OfflineWorkspaceAccessRole): OfflineWorkspaceAccessRole {
  if (!Object.values(OfflineWorkspaceAccessRoles).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline workspace access role '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeWorkspaceSharingPosture(value: OfflineWorkspaceSharingPosture): OfflineWorkspaceSharingPosture {
  if (!Object.values(OfflineWorkspaceSharingPostures).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline workspace sharing posture '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSensitivityMarking(value: OfflineSensitivityMarking): OfflineSensitivityMarking {
  if (!Object.values(OfflineSensitivityMarkings).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline sensitivity marking '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeStorageRule(value: OfflineStorageRule): OfflineStorageRule {
  if (!Object.values(OfflineStorageRules).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline storage rule '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeDeviceTrustPosture(value: OfflineDeviceTrustPosture): OfflineDeviceTrustPosture {
  if (!Object.values(OfflineDeviceTrustPostures).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline device trust posture '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizePolicyInput(input: OfflineResourcePolicyEvaluationInput): OfflineResourcePolicyEvaluationInput {
  if (!Object.values(WorkspaceVisibilities).includes(input.workspaceVisibility)) {
    throw new OfflineLocalModeDomainError(
      `Offline policy workspaceVisibility '${String(input.workspaceVisibility)}' is invalid.`,
    );
  }

  return Object.freeze({
    workspaceVisibility: input.workspaceVisibility,
    workspaceAccessRole: normalizeWorkspaceAccessRole(input.workspaceAccessRole),
    workspaceSharingPosture: normalizeWorkspaceSharingPosture(input.workspaceSharingPosture),
    sensitivityMarking: normalizeSensitivityMarking(input.sensitivityMarking),
    storageRule: normalizeStorageRule(input.storageRule),
    deviceTrustPosture: normalizeDeviceTrustPosture(input.deviceTrustPosture),
  });
}

function deniedDecision(reason: string): OfflineResourceOperationDecision {
  return Object.freeze({
    allowed: false,
    reason,
  });
}

function allowedDecision(reason: string): OfflineResourceOperationDecision {
  return Object.freeze({
    allowed: true,
    reason,
  });
}

function createOperationPolicyMatrix(
  boundary: OfflineResourceAuthorityBoundary,
): Record<keyof OfflineResourceOperationPolicyMatrix, OfflineResourceOperationDecision> {
  return {
    cache: boundary.offlineCapabilities.cache
      ? allowedDecision("Allowed by baseline resource policy.")
      : deniedDecision("Resource baseline policy does not allow offline caching."),
    read: boundary.offlineCapabilities.view
      ? allowedDecision("Allowed by baseline resource policy.")
      : deniedDecision("Resource baseline policy does not allow offline read access."),
    edit: boundary.offlineCapabilities.edit
      ? allowedDecision("Allowed by baseline resource policy.")
      : deniedDecision("Resource baseline policy does not allow offline edit."),
    queueMutation: boundary.offlineCapabilities.queueMutation
      ? allowedDecision("Allowed by baseline resource policy.")
      : deniedDecision("Resource baseline policy does not allow queued authoritative mutations."),
    execute: boundary.offlineCapabilities.execute
      ? allowedDecision("Allowed by baseline resource policy.")
      : deniedDecision("Resource baseline policy does not allow offline execution."),
  };
}

function denyPosture(
  posture: Record<keyof OfflineResourceOperationPolicyMatrix, OfflineResourceOperationDecision>,
  operation: keyof OfflineResourceOperationPolicyMatrix,
  reason: string,
): void {
  posture[operation] = deniedDecision(reason);
}

function denyAllPosture(
  posture: Record<keyof OfflineResourceOperationPolicyMatrix, OfflineResourceOperationDecision>,
  reason: string,
): void {
  denyPosture(posture, "cache", reason);
  denyPosture(posture, "read", reason);
  denyPosture(posture, "edit", reason);
  denyPosture(posture, "queueMutation", reason);
  denyPosture(posture, "execute", reason);
}

export function evaluateOfflineResourcePolicy(
  resourceClass: string,
  policyInput: OfflineResourcePolicyEvaluationInput,
): OfflineResourcePolicyEvaluation {
  const normalizedPolicy = normalizePolicyInput(policyInput);
  const boundary = resolveOfflineResourceAuthorityBoundaryIfSupported(resourceClass);
  if (!boundary) {
    const unsupportedReason = "Resource class is not in the registered offline eligibility catalog.";
    return Object.freeze({
      resourceClass,
      supportedResourceClass: false,
      posture: Object.freeze({
        cache: deniedDecision(unsupportedReason),
        read: deniedDecision(unsupportedReason),
        edit: deniedDecision(unsupportedReason),
        queueMutation: deniedDecision(unsupportedReason),
        execute: deniedDecision(unsupportedReason),
      }),
      exclusionReasons: Object.freeze([unsupportedReason]),
    });
  }

  const posture = createOperationPolicyMatrix(boundary);
  const exclusionReasons: string[] = [];

  if (!boundary.eligibility.supportsOffline) {
    const reason = "Resource class is server-only by explicit offline eligibility policy.";
    denyAllPosture(posture, reason);
    exclusionReasons.push(reason);
  }

  if (
    normalizedPolicy.workspaceAccessRole === OfflineWorkspaceAccessRoles.viewer
  ) {
    denyPosture(posture, "edit", "Viewer role is read-only in offline local mode.");
    denyPosture(posture, "queueMutation", "Viewer role cannot queue authoritative mutations.");
    denyPosture(posture, "execute", "Viewer role cannot execute local runtime operations.");
    exclusionReasons.push("Offline write/execute operations were restricted by workspace role.");
  }

  const isTrustedDevice = normalizedPolicy.deviceTrustPosture === OfflineDeviceTrustPostures.trusted;
  const isPendingDevice = normalizedPolicy.deviceTrustPosture === OfflineDeviceTrustPostures.pendingVerification;
  const isUntrustedDevice = (
    normalizedPolicy.deviceTrustPosture === OfflineDeviceTrustPostures.untrusted
    || normalizedPolicy.deviceTrustPosture === OfflineDeviceTrustPostures.revoked
  );

  if (isPendingDevice) {
    denyPosture(posture, "edit", "Trusted device verification is required before offline edit.");
    denyPosture(posture, "queueMutation", "Trusted device verification is required before queueing authoritative mutations.");
    denyPosture(posture, "execute", "Trusted device verification is required before offline execution.");
    exclusionReasons.push("Pending device trust blocks write/execute posture.");
  }

  if (isUntrustedDevice) {
    const reason = "Untrusted or revoked device cannot use offline local mode resources.";
    denyAllPosture(posture, reason);
    exclusionReasons.push(reason);
  }

  if (normalizedPolicy.storageRule === OfflineStorageRules.disallowOfflineCache) {
    denyPosture(posture, "cache", "Storage policy explicitly disallows offline caching.");
    exclusionReasons.push("Storage policy disallows offline cache.");
  }

  if (
    normalizedPolicy.storageRule === OfflineStorageRules.requireEncryptedOfflineCache
    && !isTrustedDevice
  ) {
    denyPosture(posture, "cache", "Encrypted offline cache requires trusted device posture.");
    exclusionReasons.push("Encrypted cache policy requires trusted device.");
  }

  if (
    OfflineSensitivityRank[normalizedPolicy.sensitivityMarking]
    > OfflineSensitivityRank[boundary.eligibility.maxSensitivityAllowed]
  ) {
    const reason = `Sensitivity '${normalizedPolicy.sensitivityMarking}' exceeds resource offline eligibility maximum '${boundary.eligibility.maxSensitivityAllowed}'.`;
    denyAllPosture(posture, reason);
    exclusionReasons.push(reason);
  }

  if (normalizedPolicy.sensitivityMarking === OfflineSensitivityMarkings.secret) {
    const reason = "Secret sensitivity marking is always server-only in local mode.";
    denyAllPosture(posture, reason);
    exclusionReasons.push(reason);
  }

  if (normalizedPolicy.sensitivityMarking === OfflineSensitivityMarkings.sensitive) {
    if (normalizedPolicy.storageRule !== OfflineStorageRules.requireEncryptedOfflineCache) {
      denyPosture(
        posture,
        "cache",
        "Sensitive resources require encrypted cache storage policy for offline caching.",
      );
      exclusionReasons.push("Sensitive marking requires encrypted cache policy.");
    }
    if (!isTrustedDevice) {
      denyPosture(posture, "edit", "Sensitive resources require trusted device for offline edit.");
      denyPosture(posture, "queueMutation", "Sensitive resources require trusted device for queued mutation.");
      denyPosture(posture, "execute", "Sensitive resources require trusted device for offline execution.");
      exclusionReasons.push("Sensitive marking requires trusted device for write/execute operations.");
    }
  }

  if (normalizedPolicy.sensitivityMarking === OfflineSensitivityMarkings.restricted) {
    if (!isTrustedDevice) {
      const reason = "Restricted resources require trusted device posture for all offline operations.";
      denyAllPosture(posture, reason);
      exclusionReasons.push(reason);
    }

    if (normalizedPolicy.workspaceSharingPosture !== OfflineWorkspaceSharingPostures.workspaceOnly) {
      const reason = "Restricted resources cannot be used offline when workspace sharing extends beyond workspace-only.";
      denyAllPosture(posture, reason);
      exclusionReasons.push(reason);
    }
  }

  if (
    normalizedPolicy.workspaceVisibility === WorkspaceVisibilities.public
    && !boundary.eligibility.allowPublicWorkspaceOfflineRead
  ) {
    const reason = "Resource class does not allow offline read posture in public workspaces.";
    denyPosture(posture, "read", reason);
    denyPosture(posture, "edit", reason);
    denyPosture(posture, "queueMutation", reason);
    exclusionReasons.push("Public workspace visibility reduced offline posture.");
  }

  if (
    (normalizedPolicy.workspaceSharingPosture === OfflineWorkspaceSharingPostures.externalShared
      || normalizedPolicy.workspaceSharingPosture === OfflineWorkspaceSharingPostures.publicLink)
    && !boundary.eligibility.allowExternalSharingOfflineEdit
  ) {
    denyPosture(
      posture,
      "edit",
      "External/public sharing posture does not allow offline edit for this resource class.",
    );
    denyPosture(
      posture,
      "queueMutation",
      "External/public sharing posture does not allow queued authoritative mutation for this resource class.",
    );
    exclusionReasons.push("External/public sharing posture reduced offline edit and mutation posture.");
  }

  if (boundary.eligibility.requiresTrustedDeviceForEdit && !isTrustedDevice) {
    denyPosture(posture, "edit", "Resource class requires trusted device for offline edit.");
    exclusionReasons.push("Trusted device is required for offline edit.");
  }

  if (boundary.eligibility.requiresTrustedDeviceForQueueMutation && !isTrustedDevice) {
    denyPosture(posture, "queueMutation", "Resource class requires trusted device for queued mutation.");
    exclusionReasons.push("Trusted device is required for offline queued mutation.");
  }

  if (boundary.eligibility.requiresTrustedDeviceForExecute && !isTrustedDevice) {
    denyPosture(posture, "execute", "Resource class requires trusted device for offline execution.");
    exclusionReasons.push("Trusted device is required for offline execution.");
  }

  if (
    !posture.cache.allowed
    && boundary.authoritativeStateScope === OfflineAuthorityScopes.authoritativeServer
  ) {
    denyPosture(posture, "read", "Offline read requires cached authoritative snapshot for this server-owned resource.");
  }

  return Object.freeze({
    resourceClass,
    supportedResourceClass: true,
    authoritativeStateScope: boundary.authoritativeStateScope,
    defaultStorageBucket: boundary.defaultStorageBucket,
    behaviorClass: boundary.eligibility.behaviorClass,
    posture: Object.freeze(posture),
    exclusionReasons: Object.freeze([...new Set(exclusionReasons)]),
  });
}

export const OfflineQueuedMutationIntents = Object.freeze({
  promoteLocalDraft: "promote-local-draft",
  createOrUpdateAuthoritative: "create-or-update-authoritative",
  deleteAuthoritative: "delete-authoritative",
});

export type OfflineQueuedMutationIntent =
  typeof OfflineQueuedMutationIntents[keyof typeof OfflineQueuedMutationIntents];

export const OfflineQueuedMutationStatuses = Object.freeze({
  queuedPendingSync: "queued-pending-sync",
  syncConflict: "sync-conflict",
  syncApplied: "sync-applied",
  syncRejected: "sync-rejected",
});

export type OfflineQueuedMutationStatus =
  typeof OfflineQueuedMutationStatuses[keyof typeof OfflineQueuedMutationStatuses];

export interface OfflineQueuedMutationEnvelope {
  readonly mutationId: string;
  readonly targetResourceClass: OfflineResourceClass;
  readonly targetResourceId: string;
  readonly intent: OfflineQueuedMutationIntent;
  readonly baseAuthoritativeRevision: string;
  readonly localMutationRevision: number;
  readonly queuedAt: string;
  readonly userVisibleSyncStatus: OfflineQueuedMutationStatus;
  readonly divergenceDisclosureToken: string;
}

/*
  Migration note (Story 19.1.2):
  Shared offline/sync transport-facing queue contracts now live in
  `@shared/contracts/runtime/OfflineSynchronizationContracts` as
  `OfflinePendingOperationEnvelopeDto`.
  This domain envelope remains authoritative for domain policy logic.
*/

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineLocalModeDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineLocalModeDomainError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

export function createOfflineQueuedMutationEnvelope(input: {
  readonly mutationId: string;
  readonly targetResourceClass: OfflineResourceClass;
  readonly targetResourceId: string;
  readonly intent: OfflineQueuedMutationIntent;
  readonly baseAuthoritativeRevision: string;
  readonly localMutationRevision: number;
  readonly queuedAt?: string;
  readonly userVisibleSyncStatus?: OfflineQueuedMutationStatus;
  readonly divergenceDisclosureToken: string;
}): OfflineQueuedMutationEnvelope {
  const boundary = resolveOfflineResourceAuthorityBoundary(input.targetResourceClass);
  if (!boundary.offlineCapabilities.queueMutation) {
    throw new OfflineLocalModeDomainError(
      `Resource class '${input.targetResourceClass}' does not allow queued offline mutations.`,
    );
  }
  if (!Object.values(OfflineQueuedMutationIntents).includes(input.intent)) {
    throw new OfflineLocalModeDomainError(`Queued mutation intent '${String(input.intent)}' is invalid.`);
  }

  const status = input.userVisibleSyncStatus ?? OfflineQueuedMutationStatuses.queuedPendingSync;
  if (!Object.values(OfflineQueuedMutationStatuses).includes(status)) {
    throw new OfflineLocalModeDomainError(`Queued mutation status '${String(status)}' is invalid.`);
  }
  if (status === OfflineQueuedMutationStatuses.syncApplied) {
    throw new OfflineLocalModeDomainError(
      "Queued offline mutation cannot be pre-marked as sync-applied before authoritative reconciliation.",
    );
  }

  const localMutationRevision = Number.isInteger(input.localMutationRevision)
    ? input.localMutationRevision
    : Number.NaN;
  if (!Number.isInteger(localMutationRevision) || localMutationRevision < 1) {
    throw new OfflineLocalModeDomainError("Queued mutation localMutationRevision must be an integer >= 1.");
  }

  const envelope = Object.freeze({
    mutationId: normalizeRequired(input.mutationId, "Queued mutation mutationId"),
    targetResourceClass: input.targetResourceClass,
    targetResourceId: normalizeRequired(input.targetResourceId, "Queued mutation targetResourceId"),
    intent: input.intent,
    baseAuthoritativeRevision: normalizeRequired(
      input.baseAuthoritativeRevision,
      "Queued mutation baseAuthoritativeRevision",
    ),
    localMutationRevision,
    queuedAt: normalizeIsoTimestamp(input.queuedAt ?? new Date().toISOString(), "Queued mutation queuedAt"),
    userVisibleSyncStatus: status,
    divergenceDisclosureToken: normalizeRequired(
      input.divergenceDisclosureToken,
      "Queued mutation divergenceDisclosureToken",
    ),
  });

  assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal(envelope);
  return envelope;
}

export function assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal(
  envelope: Pick<OfflineQueuedMutationEnvelope, "userVisibleSyncStatus" | "divergenceDisclosureToken">,
): void {
  const token = envelope.divergenceDisclosureToken.trim();
  if (!token) {
    throw new OfflineLocalModeDomainError(
      "Queued offline mutation must include divergenceDisclosureToken to prevent silent global divergence.",
    );
  }
  if (
    envelope.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.queuedPendingSync
    && envelope.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.syncConflict
    && envelope.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.syncRejected
  ) {
    throw new OfflineLocalModeDomainError(
      `Queued offline mutation status '${String(envelope.userVisibleSyncStatus)}' is not valid for visible pending reconciliation.`,
    );
  }
}
