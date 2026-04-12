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

export const OfflineLocalExecutionClasses = Object.freeze({
  localWorkflowPreview: "local-workflow-preview",
  localWorkflowValidation: "local-workflow-validation",
  remoteOrchestratedRunReplay: "remote-orchestrated-run-replay",
  distributedClusterRun: "distributed-cluster-run",
  secretMaterializedExecution: "secret-materialized-execution",
});

export type OfflineLocalExecutionClass =
  typeof OfflineLocalExecutionClasses[keyof typeof OfflineLocalExecutionClasses];

export const OfflineNodeOperationalModes = Object.freeze({
  workstationClient: "workstation-client",
  managedWorkstationClient: "managed-workstation-client",
  dedicatedExecutor: "dedicated-executor",
  authoritativeControlPlane: "authoritative-control-plane",
});

export type OfflineNodeOperationalMode =
  typeof OfflineNodeOperationalModes[keyof typeof OfflineNodeOperationalModes];

export const OfflineWorkstationModes = Object.freeze({
  interactiveUserSession: "interactive-user-session",
  managedBackgroundAgent: "managed-background-agent",
  sharedKioskSession: "shared-kiosk-session",
  headlessService: "headless-service",
});

export type OfflineWorkstationMode =
  typeof OfflineWorkstationModes[keyof typeof OfflineWorkstationModes];

export const OfflineLocalExecutionHistoryScopes = Object.freeze({
  explicitLocalActivity: "explicit-local-activity",
  outOfScopeNoRegistration: "out-of-scope-no-registration",
});

export type OfflineLocalExecutionHistoryScope =
  typeof OfflineLocalExecutionHistoryScopes[keyof typeof OfflineLocalExecutionHistoryScopes];

export interface OfflineLocalExecutionPolicyInput {
  readonly executionClass: OfflineLocalExecutionClass | string;
  readonly resourceClass: OfflineResourceClass | string;
  readonly resourcePolicy: OfflineResourcePolicyEvaluationInput;
  readonly nodeOperationalMode: OfflineNodeOperationalMode;
  readonly workstationMode: OfflineWorkstationMode;
  readonly allowOfflineExecutionByPolicy: boolean;
  readonly allowAuthoritativeRegistrationByPolicy: boolean;
}

export interface OfflineLocalExecutionEligibilityEvaluation {
  readonly executionClass: string;
  readonly supportedExecutionClass: boolean;
  readonly resourceClass: string;
  readonly allowed: boolean;
  readonly historyScope: OfflineLocalExecutionHistoryScope;
  readonly requiresMetadataCapture: boolean;
  readonly requiresLaterAuthoritativeRegistration: boolean;
  readonly exclusionReasons: ReadonlyArray<string>;
}

export interface OfflineLocalExecutionClassPolicy {
  readonly executionClass: OfflineLocalExecutionClass;
  readonly supportedInProductionScope: boolean;
  readonly requiredResourceClass?: OfflineResourceClass;
  readonly allowedNodeOperationalModes: ReadonlyArray<OfflineNodeOperationalMode>;
  readonly allowedWorkstationModes: ReadonlyArray<OfflineWorkstationMode>;
  readonly requiresTrustedDevice: boolean;
  readonly requiresAuthoritativeRegistration: boolean;
  readonly outOfScopeReason?: string;
}

const OfflineLocalExecutionClassPolicyCatalog: Readonly<
  Record<OfflineLocalExecutionClass, OfflineLocalExecutionClassPolicy>
> = Object.freeze({
  [OfflineLocalExecutionClasses.localWorkflowPreview]: Object.freeze({
    executionClass: OfflineLocalExecutionClasses.localWorkflowPreview,
    supportedInProductionScope: true,
    requiredResourceClass: OfflineResourceClasses.localRuntimeSession,
    allowedNodeOperationalModes: Object.freeze([
      OfflineNodeOperationalModes.workstationClient,
      OfflineNodeOperationalModes.managedWorkstationClient,
    ]),
    allowedWorkstationModes: Object.freeze([
      OfflineWorkstationModes.interactiveUserSession,
      OfflineWorkstationModes.managedBackgroundAgent,
    ]),
    requiresTrustedDevice: true,
    requiresAuthoritativeRegistration: true,
  }),
  [OfflineLocalExecutionClasses.localWorkflowValidation]: Object.freeze({
    executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
    supportedInProductionScope: true,
    requiredResourceClass: OfflineResourceClasses.localRuntimeSession,
    allowedNodeOperationalModes: Object.freeze([
      OfflineNodeOperationalModes.workstationClient,
      OfflineNodeOperationalModes.managedWorkstationClient,
    ]),
    allowedWorkstationModes: Object.freeze([
      OfflineWorkstationModes.interactiveUserSession,
      OfflineWorkstationModes.managedBackgroundAgent,
    ]),
    requiresTrustedDevice: true,
    requiresAuthoritativeRegistration: true,
  }),
  [OfflineLocalExecutionClasses.remoteOrchestratedRunReplay]: Object.freeze({
    executionClass: OfflineLocalExecutionClasses.remoteOrchestratedRunReplay,
    supportedInProductionScope: false,
    allowedNodeOperationalModes: Object.freeze([]),
    allowedWorkstationModes: Object.freeze([]),
    requiresTrustedDevice: true,
    requiresAuthoritativeRegistration: false,
    outOfScopeReason:
      "Remote orchestrated replay is out of scope for first production offline execution posture.",
  }),
  [OfflineLocalExecutionClasses.distributedClusterRun]: Object.freeze({
    executionClass: OfflineLocalExecutionClasses.distributedClusterRun,
    supportedInProductionScope: false,
    allowedNodeOperationalModes: Object.freeze([]),
    allowedWorkstationModes: Object.freeze([]),
    requiresTrustedDevice: true,
    requiresAuthoritativeRegistration: false,
    outOfScopeReason:
      "Distributed cluster execution is out of scope for first production offline execution posture.",
  }),
  [OfflineLocalExecutionClasses.secretMaterializedExecution]: Object.freeze({
    executionClass: OfflineLocalExecutionClasses.secretMaterializedExecution,
    supportedInProductionScope: false,
    allowedNodeOperationalModes: Object.freeze([]),
    allowedWorkstationModes: Object.freeze([]),
    requiresTrustedDevice: true,
    requiresAuthoritativeRegistration: false,
    outOfScopeReason:
      "Secret-materialized offline execution is out of scope for first production offline execution posture.",
  }),
});

function resolveOfflineLocalExecutionClassPolicyIfSupported(
  executionClass: string,
): OfflineLocalExecutionClassPolicy | undefined {
  const byClass = OfflineLocalExecutionClassPolicyCatalog as Record<string, OfflineLocalExecutionClassPolicy | undefined>;
  return byClass[executionClass];
}

function normalizeOfflineNodeOperationalMode(value: OfflineNodeOperationalMode): OfflineNodeOperationalMode {
  if (!Object.values(OfflineNodeOperationalModes).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline node operational mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeOfflineWorkstationMode(value: OfflineWorkstationMode): OfflineWorkstationMode {
  if (!Object.values(OfflineWorkstationModes).includes(value)) {
    throw new OfflineLocalModeDomainError(`Offline workstation mode '${String(value)}' is invalid.`);
  }
  return value;
}

export function listOfflineLocalExecutionClassPolicies(): ReadonlyArray<OfflineLocalExecutionClassPolicy> {
  return Object.freeze(Object.values(OfflineLocalExecutionClassPolicyCatalog));
}

export function evaluateOfflineLocalExecutionEligibility(
  input: OfflineLocalExecutionPolicyInput,
): OfflineLocalExecutionEligibilityEvaluation {
  const nodeOperationalMode = normalizeOfflineNodeOperationalMode(input.nodeOperationalMode);
  const workstationMode = normalizeOfflineWorkstationMode(input.workstationMode);
  const classPolicy = resolveOfflineLocalExecutionClassPolicyIfSupported(input.executionClass);
  if (!classPolicy) {
    return Object.freeze({
      executionClass: input.executionClass,
      supportedExecutionClass: false,
      resourceClass: input.resourceClass,
      allowed: false,
      historyScope: OfflineLocalExecutionHistoryScopes.outOfScopeNoRegistration,
      requiresMetadataCapture: false,
      requiresLaterAuthoritativeRegistration: false,
      exclusionReasons: Object.freeze([
        "Execution class is not in the registered offline local-execution eligibility catalog.",
      ]),
    });
  }

  if (!classPolicy.supportedInProductionScope) {
    return Object.freeze({
      executionClass: input.executionClass,
      supportedExecutionClass: true,
      resourceClass: input.resourceClass,
      allowed: false,
      historyScope: OfflineLocalExecutionHistoryScopes.outOfScopeNoRegistration,
      requiresMetadataCapture: false,
      requiresLaterAuthoritativeRegistration: false,
      exclusionReasons: Object.freeze([classPolicy.outOfScopeReason ?? "Execution class is out of scope."]),
    });
  }

  const exclusionReasons: string[] = [];
  const resourcePolicy = evaluateOfflineResourcePolicy(input.resourceClass, input.resourcePolicy);
  if (!resourcePolicy.supportedResourceClass) {
    exclusionReasons.push("Resource class is not registered for offline policy evaluation.");
  } else if (!resourcePolicy.posture.execute.allowed) {
    exclusionReasons.push(resourcePolicy.posture.execute.reason);
  }

  if (classPolicy.requiredResourceClass && input.resourceClass !== classPolicy.requiredResourceClass) {
    exclusionReasons.push(
      `Execution class '${classPolicy.executionClass}' requires resource class '${classPolicy.requiredResourceClass}'.`,
    );
  }

  if (!classPolicy.allowedNodeOperationalModes.includes(nodeOperationalMode)) {
    exclusionReasons.push(
      `Node operational mode '${nodeOperationalMode}' is not eligible for execution class '${classPolicy.executionClass}'.`,
    );
  }

  if (!classPolicy.allowedWorkstationModes.includes(workstationMode)) {
    exclusionReasons.push(
      `Workstation mode '${workstationMode}' is not eligible for execution class '${classPolicy.executionClass}'.`,
    );
  }

  if (!input.allowOfflineExecutionByPolicy) {
    exclusionReasons.push("Policy input disallows offline local execution for this workspace context.");
  }

  if (classPolicy.requiresAuthoritativeRegistration && !input.allowAuthoritativeRegistrationByPolicy) {
    exclusionReasons.push("Policy input disallows reconnect registration of local execution activity.");
  }

  return Object.freeze({
    executionClass: input.executionClass,
    supportedExecutionClass: true,
    resourceClass: input.resourceClass,
    allowed: exclusionReasons.length < 1,
    historyScope: OfflineLocalExecutionHistoryScopes.explicitLocalActivity,
    requiresMetadataCapture: true,
    requiresLaterAuthoritativeRegistration: classPolicy.requiresAuthoritativeRegistration,
    exclusionReasons: Object.freeze([...new Set(exclusionReasons)]),
  });
}

export const OfflineLocalExecutionOutcomes = Object.freeze({
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type OfflineLocalExecutionOutcome =
  typeof OfflineLocalExecutionOutcomes[keyof typeof OfflineLocalExecutionOutcomes];

export const OfflineLocalExecutionOutputClasses = Object.freeze({
  logBundle: "log-bundle",
  previewArtifact: "preview-artifact",
  metricsSnapshot: "metrics-snapshot",
});

export type OfflineLocalExecutionOutputClass =
  typeof OfflineLocalExecutionOutputClasses[keyof typeof OfflineLocalExecutionOutputClasses];

export interface OfflineLocalExecutionOutputRecord {
  readonly outputId: string;
  readonly outputClass: OfflineLocalExecutionOutputClass;
  readonly contentDigest: string;
  readonly sizeBytes?: number;
}

export interface OfflineLocalExecutionRecord {
  readonly executionId: string;
  readonly executionClass: OfflineLocalExecutionClass;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly executedByActorUserIdentityId: string;
  readonly nodeOperationalMode: OfflineNodeOperationalMode;
  readonly workstationMode: OfflineWorkstationMode;
  readonly outcome: OfflineLocalExecutionOutcome;
  readonly inputDigest: string;
  readonly outputs: ReadonlyArray<OfflineLocalExecutionOutputRecord>;
  readonly historyScope: OfflineLocalExecutionHistoryScope;
}

export function createOfflineLocalExecutionRecord(input: {
  readonly executionId: string;
  readonly executionClass: OfflineLocalExecutionClass;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly executedByActorUserIdentityId: string;
  readonly nodeOperationalMode: OfflineNodeOperationalMode;
  readonly workstationMode: OfflineWorkstationMode;
  readonly outcome: OfflineLocalExecutionOutcome;
  readonly inputDigest: string;
  readonly outputs: ReadonlyArray<OfflineLocalExecutionOutputRecord>;
  readonly historyScope?: OfflineLocalExecutionHistoryScope;
}): OfflineLocalExecutionRecord {
  const classPolicy = resolveOfflineLocalExecutionClassPolicyIfSupported(input.executionClass);
  if (!classPolicy || !classPolicy.supportedInProductionScope) {
    throw new OfflineLocalModeDomainError(
      `Execution class '${input.executionClass}' is out of production offline local-execution scope.`,
    );
  }
  if (classPolicy.requiredResourceClass && input.resourceClass !== classPolicy.requiredResourceClass) {
    throw new OfflineLocalModeDomainError(
      `Execution class '${input.executionClass}' requires resource class '${classPolicy.requiredResourceClass}'.`,
    );
  }
  if (!classPolicy.allowedNodeOperationalModes.includes(input.nodeOperationalMode)) {
    throw new OfflineLocalModeDomainError(
      `Execution class '${input.executionClass}' is not eligible for node operational mode '${input.nodeOperationalMode}'.`,
    );
  }
  if (!classPolicy.allowedWorkstationModes.includes(input.workstationMode)) {
    throw new OfflineLocalModeDomainError(
      `Execution class '${input.executionClass}' is not eligible for workstation mode '${input.workstationMode}'.`,
    );
  }

  if (!Object.values(OfflineLocalExecutionOutcomes).includes(input.outcome)) {
    throw new OfflineLocalModeDomainError(`Offline local execution outcome '${String(input.outcome)}' is invalid.`);
  }

  const historyScope = input.historyScope ?? OfflineLocalExecutionHistoryScopes.explicitLocalActivity;
  if (historyScope !== OfflineLocalExecutionHistoryScopes.explicitLocalActivity) {
    throw new OfflineLocalModeDomainError(
      "Offline local execution records must remain explicit local activity until authoritative registration.",
    );
  }

  const startedAt = normalizeIsoTimestamp(input.startedAt ?? new Date().toISOString(), "Local execution startedAt");
  const completedAt = normalizeIsoTimestamp(
    input.completedAt ?? input.startedAt ?? new Date().toISOString(),
    "Local execution completedAt",
  );
  if (new Date(completedAt).getTime() < new Date(startedAt).getTime()) {
    throw new OfflineLocalModeDomainError("Local execution completedAt cannot be earlier than startedAt.");
  }

  const normalizedOutputs = Object.freeze(input.outputs.map((output) => {
    if (!Object.values(OfflineLocalExecutionOutputClasses).includes(output.outputClass)) {
      throw new OfflineLocalModeDomainError(
        `Offline local execution outputClass '${String(output.outputClass)}' is invalid.`,
      );
    }
    const sizeBytes = output.sizeBytes;
    if (sizeBytes !== undefined && (!Number.isInteger(sizeBytes) || sizeBytes < 0)) {
      throw new OfflineLocalModeDomainError("Offline local execution output sizeBytes must be an integer >= 0.");
    }
    return Object.freeze({
      outputId: normalizeRequired(output.outputId, "Local execution outputId"),
      outputClass: output.outputClass,
      contentDigest: normalizeRequired(output.contentDigest, "Local execution output contentDigest"),
      sizeBytes,
    });
  }));

  return Object.freeze({
    executionId: normalizeRequired(input.executionId, "Local execution executionId"),
    executionClass: input.executionClass,
    resourceClass: input.resourceClass,
    resourceId: normalizeRequired(input.resourceId, "Local execution resourceId"),
    startedAt,
    completedAt,
    executedByActorUserIdentityId: normalizeRequired(
      input.executedByActorUserIdentityId,
      "Local execution executedByActorUserIdentityId",
    ),
    nodeOperationalMode: normalizeOfflineNodeOperationalMode(input.nodeOperationalMode),
    workstationMode: normalizeOfflineWorkstationMode(input.workstationMode),
    outcome: input.outcome,
    inputDigest: normalizeRequired(input.inputDigest, "Local execution inputDigest"),
    outputs: normalizedOutputs,
    historyScope,
  });
}

export const OfflineLocalExecutionRegistrationStatuses = Object.freeze({
  queuedPendingRegistration: "queued-pending-registration",
  registrationConflict: "registration-conflict",
  registrationRejected: "registration-rejected",
  registrationApplied: "registration-applied",
});

export type OfflineLocalExecutionRegistrationStatus =
  typeof OfflineLocalExecutionRegistrationStatuses[keyof typeof OfflineLocalExecutionRegistrationStatuses];

export interface OfflineLocalExecutionRegistrationReplayDescriptor {
  readonly method: OfflineMutationReplayHttpMethod;
  readonly path: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadContentType?: string;
}

export interface OfflineLocalExecutionRegistrationEnvelope {
  readonly registrationId: string;
  readonly execution: OfflineLocalExecutionRecord;
  readonly executionId: string;
  readonly executionClass: OfflineLocalExecutionClass;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly queuedAt: string;
  readonly userVisibleRegistrationStatus: OfflineLocalExecutionRegistrationStatus;
  readonly divergenceDisclosureToken: string;
  readonly replayDescriptor: OfflineLocalExecutionRegistrationReplayDescriptor;
}

export function createOfflineLocalExecutionRegistrationEnvelope(input: {
  readonly registrationId: string;
  readonly execution: OfflineLocalExecutionRecord;
  readonly queuedAt?: string;
  readonly userVisibleRegistrationStatus?: OfflineLocalExecutionRegistrationStatus;
  readonly divergenceDisclosureToken: string;
  readonly replayDescriptor: OfflineLocalExecutionRegistrationReplayDescriptor;
}): OfflineLocalExecutionRegistrationEnvelope {
  if (input.execution.historyScope !== OfflineLocalExecutionHistoryScopes.explicitLocalActivity) {
    throw new OfflineLocalModeDomainError(
      "Only explicit local execution records can be queued for authoritative registration.",
    );
  }

  const status = input.userVisibleRegistrationStatus
    ?? OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration;
  if (!Object.values(OfflineLocalExecutionRegistrationStatuses).includes(status)) {
    throw new OfflineLocalModeDomainError(
      `Local execution registration status '${String(status)}' is invalid.`,
    );
  }
  if (status === OfflineLocalExecutionRegistrationStatuses.registrationApplied) {
    throw new OfflineLocalModeDomainError(
      "Local execution registration cannot be pre-marked as registration-applied before authoritative acceptance.",
    );
  }

  const replayDescriptor = normalizeOfflineQueuedMutationReplayDescriptor(input.replayDescriptor);
  if (!replayDescriptor.path.includes("/offline/local-executions/")) {
    throw new OfflineLocalModeDomainError(
      "Local execution registration replay path must target offline local execution registration endpoints.",
    );
  }

  const divergenceDisclosureToken = normalizeRequired(
    input.divergenceDisclosureToken,
    "Local execution registration divergenceDisclosureToken",
  );

  return Object.freeze({
    registrationId: normalizeRequired(input.registrationId, "Local execution registrationId"),
    execution: input.execution,
    executionId: input.execution.executionId,
    executionClass: input.execution.executionClass,
    resourceClass: input.execution.resourceClass,
    resourceId: input.execution.resourceId,
    queuedAt: normalizeIsoTimestamp(
      input.queuedAt ?? new Date().toISOString(),
      "Local execution registration queuedAt",
    ),
    userVisibleRegistrationStatus: status,
    divergenceDisclosureToken,
    replayDescriptor,
  });
}

export const OfflineDraftSynchronizationStatuses = Object.freeze({
  localOnly: "local-only",
  queuedPendingSync: "queued-pending-sync",
  syncConflict: "sync-conflict",
  syncRejected: "sync-rejected",
  syncApplied: "sync-applied",
});

export type OfflineDraftSynchronizationStatus =
  typeof OfflineDraftSynchronizationStatuses[keyof typeof OfflineDraftSynchronizationStatuses];

export const OfflineLocalDraftChangeKinds = Object.freeze({
  create: "create",
  update: "update",
  delete: "delete",
  reorder: "reorder",
  metadata: "metadata",
});

export type OfflineLocalDraftChangeKind =
  typeof OfflineLocalDraftChangeKinds[keyof typeof OfflineLocalDraftChangeKinds];

export interface OfflineLocalDraftChangeRecord {
  readonly changeId: string;
  readonly draftId: string;
  readonly resourceId: string;
  readonly kind: OfflineLocalDraftChangeKind;
  readonly changedAt: string;
  readonly changedByActorUserIdentityId: string;
  readonly path?: string;
  readonly summary?: string;
}

export interface OfflineLocalDraftDocument {
  readonly draftId: string;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly baseAuthoritativeRevision: string;
  readonly authoritativeSnapshotRevision: string;
  readonly draftRevision: number;
  readonly syncStatus: OfflineDraftSynchronizationStatus;
  readonly queuedMutationId?: string;
  readonly lastEditedAt: string;
  readonly lastEditedByActorUserIdentityId: string;
  readonly localChanges: ReadonlyArray<OfflineLocalDraftChangeRecord>;
}

export function createOfflineLocalDraftDocument(input: {
  readonly draftId: string;
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly baseAuthoritativeRevision: string;
  readonly authoritativeSnapshotRevision?: string;
  readonly draftRevision?: number;
  readonly syncStatus?: OfflineDraftSynchronizationStatus;
  readonly queuedMutationId?: string;
  readonly lastEditedAt?: string;
  readonly lastEditedByActorUserIdentityId: string;
  readonly localChanges?: ReadonlyArray<OfflineLocalDraftChangeRecord>;
}): OfflineLocalDraftDocument {
  const boundary = resolveOfflineResourceAuthorityBoundary(input.resourceClass);
  if (boundary.authoritativeStateScope !== OfflineAuthorityScopes.localDraft) {
    throw new OfflineLocalModeDomainError(
      `Resource class '${input.resourceClass}' is not eligible for local-draft state.`,
    );
  }

  const draftRevision = input.draftRevision ?? 1;
  if (!Number.isInteger(draftRevision) || draftRevision < 1) {
    throw new OfflineLocalModeDomainError("Local draft draftRevision must be an integer >= 1.");
  }

  const syncStatus = input.syncStatus ?? OfflineDraftSynchronizationStatuses.localOnly;
  if (!Object.values(OfflineDraftSynchronizationStatuses).includes(syncStatus)) {
    throw new OfflineLocalModeDomainError(`Offline draft syncStatus '${String(syncStatus)}' is invalid.`);
  }

  const queuedMutationId = input.queuedMutationId?.trim();
  if (syncStatus === OfflineDraftSynchronizationStatuses.queuedPendingSync && !queuedMutationId) {
    throw new OfflineLocalModeDomainError(
      "Queued local draft state requires queuedMutationId for explicit synchronization tracking.",
    );
  }
  if (syncStatus === OfflineDraftSynchronizationStatuses.localOnly && queuedMutationId) {
    throw new OfflineLocalModeDomainError(
      "Local-only draft state cannot retain queuedMutationId after local edits.",
    );
  }

  const normalizedChanges = Object.freeze([...(input.localChanges ?? [])].map((change) => Object.freeze({
    changeId: normalizeRequired(change.changeId, "Local draft changeId"),
    draftId: normalizeRequired(change.draftId, "Local draft change draftId"),
    resourceId: normalizeRequired(change.resourceId, "Local draft change resourceId"),
    kind: normalizeOfflineLocalDraftChangeKind(change.kind),
    changedAt: normalizeIsoTimestamp(change.changedAt, "Local draft change changedAt"),
    changedByActorUserIdentityId: normalizeRequired(
      change.changedByActorUserIdentityId,
      "Local draft change changedByActorUserIdentityId",
    ),
    path: change.path?.trim() ? change.path.trim() : undefined,
    summary: change.summary?.trim() ? change.summary.trim() : undefined,
  })));

  return Object.freeze({
    draftId: normalizeRequired(input.draftId, "Local draft draftId"),
    resourceClass: input.resourceClass,
    resourceId: normalizeRequired(input.resourceId, "Local draft resourceId"),
    baseAuthoritativeRevision: normalizeRequired(
      input.baseAuthoritativeRevision,
      "Local draft baseAuthoritativeRevision",
    ),
    authoritativeSnapshotRevision: normalizeRequired(
      input.authoritativeSnapshotRevision ?? input.baseAuthoritativeRevision,
      "Local draft authoritativeSnapshotRevision",
    ),
    draftRevision,
    syncStatus,
    queuedMutationId,
    lastEditedAt: normalizeIsoTimestamp(input.lastEditedAt ?? new Date().toISOString(), "Local draft lastEditedAt"),
    lastEditedByActorUserIdentityId: normalizeRequired(
      input.lastEditedByActorUserIdentityId,
      "Local draft lastEditedByActorUserIdentityId",
    ),
    localChanges: normalizedChanges,
  });
}

function normalizeOfflineLocalDraftChangeKind(value: OfflineLocalDraftChangeKind): OfflineLocalDraftChangeKind {
  if (!Object.values(OfflineLocalDraftChangeKinds).includes(value)) {
    throw new OfflineLocalModeDomainError(`Local draft change kind '${String(value)}' is invalid.`);
  }
  return value;
}

function resolveAllowedDraftSyncTransitions(
  status: OfflineDraftSynchronizationStatus,
): ReadonlyArray<OfflineDraftSynchronizationStatus> {
  const transitions: Record<OfflineDraftSynchronizationStatus, ReadonlyArray<OfflineDraftSynchronizationStatus>> = {
    [OfflineDraftSynchronizationStatuses.localOnly]: Object.freeze([
      OfflineDraftSynchronizationStatuses.localOnly,
      OfflineDraftSynchronizationStatuses.queuedPendingSync,
    ]),
    [OfflineDraftSynchronizationStatuses.queuedPendingSync]: Object.freeze([
      OfflineDraftSynchronizationStatuses.queuedPendingSync,
      OfflineDraftSynchronizationStatuses.syncConflict,
      OfflineDraftSynchronizationStatuses.syncRejected,
      OfflineDraftSynchronizationStatuses.syncApplied,
    ]),
    [OfflineDraftSynchronizationStatuses.syncConflict]: Object.freeze([
      OfflineDraftSynchronizationStatuses.syncConflict,
      OfflineDraftSynchronizationStatuses.queuedPendingSync,
      OfflineDraftSynchronizationStatuses.syncRejected,
    ]),
    [OfflineDraftSynchronizationStatuses.syncRejected]: Object.freeze([
      OfflineDraftSynchronizationStatuses.syncRejected,
      OfflineDraftSynchronizationStatuses.queuedPendingSync,
    ]),
    [OfflineDraftSynchronizationStatuses.syncApplied]: Object.freeze([
      OfflineDraftSynchronizationStatuses.syncApplied,
      OfflineDraftSynchronizationStatuses.localOnly,
    ]),
  };
  return transitions[status];
}

export function transitionOfflineLocalDraftSynchronizationStatus(input: {
  readonly draft: OfflineLocalDraftDocument;
  readonly nextStatus: OfflineDraftSynchronizationStatus;
  readonly queuedMutationId?: string;
  readonly lastEditedAt?: string;
}): OfflineLocalDraftDocument {
  const nextStatus = input.nextStatus;
  if (!Object.values(OfflineDraftSynchronizationStatuses).includes(nextStatus)) {
    throw new OfflineLocalModeDomainError(`Offline draft nextStatus '${String(nextStatus)}' is invalid.`);
  }

  const allowed = resolveAllowedDraftSyncTransitions(input.draft.syncStatus);
  if (!allowed.includes(nextStatus)) {
    throw new OfflineLocalModeDomainError(
      `Offline draft cannot transition from '${input.draft.syncStatus}' to '${nextStatus}'.`,
    );
  }

  const queuedMutationId = (
    nextStatus === OfflineDraftSynchronizationStatuses.queuedPendingSync
      ? normalizeRequired(input.queuedMutationId ?? input.draft.queuedMutationId ?? "", "Local draft queuedMutationId")
      : undefined
  );

  return createOfflineLocalDraftDocument({
    ...input.draft,
    syncStatus: nextStatus,
    queuedMutationId,
    lastEditedAt: input.lastEditedAt ?? input.draft.lastEditedAt,
  });
}

export function appendOfflineLocalDraftChange(input: {
  readonly draft: OfflineLocalDraftDocument;
  readonly changeId: string;
  readonly kind: OfflineLocalDraftChangeKind;
  readonly changedByActorUserIdentityId: string;
  readonly changedAt?: string;
  readonly path?: string;
  readonly summary?: string;
}): OfflineLocalDraftDocument {
  const changedAt = normalizeIsoTimestamp(input.changedAt ?? new Date().toISOString(), "Local draft change changedAt");
  const updatedChanges = Object.freeze([
    ...input.draft.localChanges,
    Object.freeze({
      changeId: normalizeRequired(input.changeId, "Local draft changeId"),
      draftId: input.draft.draftId,
      resourceId: input.draft.resourceId,
      kind: normalizeOfflineLocalDraftChangeKind(input.kind),
      changedAt,
      changedByActorUserIdentityId: normalizeRequired(
        input.changedByActorUserIdentityId,
        "Local draft changedByActorUserIdentityId",
      ),
      path: input.path?.trim() ? input.path.trim() : undefined,
      summary: input.summary?.trim() ? input.summary.trim() : undefined,
    }),
  ]);

  return createOfflineLocalDraftDocument({
    ...input.draft,
    draftRevision: input.draft.draftRevision + 1,
    syncStatus: OfflineDraftSynchronizationStatuses.localOnly,
    queuedMutationId: undefined,
    lastEditedAt: changedAt,
    lastEditedByActorUserIdentityId: input.changedByActorUserIdentityId,
    localChanges: updatedChanges,
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

export const OfflineMutationReplayHttpMethods = Object.freeze({
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
});

export type OfflineMutationReplayHttpMethod =
  typeof OfflineMutationReplayHttpMethods[keyof typeof OfflineMutationReplayHttpMethods];

export interface OfflineQueuedMutationReplayDescriptor {
  readonly method: OfflineMutationReplayHttpMethod;
  readonly path: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadContentType?: string;
}

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
  readonly replayDescriptor: OfflineQueuedMutationReplayDescriptor;
}

export interface OfflinePendingRunSubmissionRecord {
  readonly submissionId: string;
  readonly queuedMutation: OfflineQueuedMutationEnvelope;
  readonly requestedAt: string;
  readonly requestedByActorUserIdentityId: string;
  readonly workflowDefinitionId: string;
  readonly inputDigest: string;
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
  readonly replayDescriptor: OfflineQueuedMutationReplayDescriptor;
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
    replayDescriptor: normalizeOfflineQueuedMutationReplayDescriptor(input.replayDescriptor),
  });

  assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal(envelope);
  return envelope;
}

function normalizeOfflineQueuedMutationReplayDescriptor(
  descriptor: OfflineQueuedMutationReplayDescriptor,
): OfflineQueuedMutationReplayDescriptor {
  if (!Object.values(OfflineMutationReplayHttpMethods).includes(descriptor.method)) {
    throw new OfflineLocalModeDomainError(
      `Queued mutation replay descriptor method '${String(descriptor.method)}' is invalid.`,
    );
  }

  const payload = descriptor.payload as Record<string, unknown>;
  if (!payload || Array.isArray(payload)) {
    throw new OfflineLocalModeDomainError(
      "Queued mutation replay descriptor payload must be an object.",
    );
  }

  const path = normalizeRequired(descriptor.path, "Queued mutation replay descriptor path");
  if (!path.startsWith("/")) {
    throw new OfflineLocalModeDomainError(
      "Queued mutation replay descriptor path must be rooted (start with '/').",
    );
  }

  return Object.freeze({
    method: descriptor.method,
    path,
    idempotencyKey: normalizeRequired(
      descriptor.idempotencyKey,
      "Queued mutation replay descriptor idempotencyKey",
    ),
    payload: Object.freeze({ ...payload }),
    payloadContentType: descriptor.payloadContentType?.trim()
      ? descriptor.payloadContentType.trim()
      : undefined,
  });
}

export function assertOfflineQueuedMutationEnvelopeRequiresVisibleDivergenceSignal(
  envelope: Pick<
    OfflineQueuedMutationEnvelope,
    "userVisibleSyncStatus" | "divergenceDisclosureToken" | "replayDescriptor"
  >,
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
  normalizeOfflineQueuedMutationReplayDescriptor(envelope.replayDescriptor);
}

export function createOfflinePendingRunSubmissionRecord(input: {
  readonly submissionId: string;
  readonly queuedMutation: OfflineQueuedMutationEnvelope;
  readonly requestedAt?: string;
  readonly requestedByActorUserIdentityId: string;
  readonly workflowDefinitionId: string;
  readonly inputDigest: string;
}): OfflinePendingRunSubmissionRecord {
  if (input.queuedMutation.targetResourceClass !== OfflineResourceClasses.runSubmissionIntent) {
    throw new OfflineLocalModeDomainError(
      "Pending run submission records require queued mutation targetResourceClass='run-submission-intent'.",
    );
  }
  if (input.queuedMutation.intent !== OfflineQueuedMutationIntents.createOrUpdateAuthoritative) {
    throw new OfflineLocalModeDomainError(
      "Pending run submission records require queued mutation intent='create-or-update-authoritative'.",
    );
  }

  return Object.freeze({
    submissionId: normalizeRequired(input.submissionId, "Pending run submission submissionId"),
    queuedMutation: input.queuedMutation,
    requestedAt: normalizeIsoTimestamp(
      input.requestedAt ?? new Date().toISOString(),
      "Pending run submission requestedAt",
    ),
    requestedByActorUserIdentityId: normalizeRequired(
      input.requestedByActorUserIdentityId,
      "Pending run submission requestedByActorUserIdentityId",
    ),
    workflowDefinitionId: normalizeRequired(
      input.workflowDefinitionId,
      "Pending run submission workflowDefinitionId",
    ),
    inputDigest: normalizeRequired(input.inputDigest, "Pending run submission inputDigest"),
  });
}
