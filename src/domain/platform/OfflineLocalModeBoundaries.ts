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
  readonly reconnectionPolicy: string;
  readonly prohibitedPatterns: ReadonlyArray<OfflineProhibitedPattern>;
}

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
