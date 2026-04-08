import {
  OfflineCacheFreshnessStates,
  OfflineConnectivityStates,
  OfflineDraftSyncStatuses,
  OfflineLocalExecutionRegistrationStatuses,
  OfflinePendingOperationStatuses,
  OfflineReconciliationActions,
  OfflineSynchronizationStates,
  type OfflineSynchronizationStateSnapshotDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";

export type DesktopOfflineBannerTone = "neutral" | "info" | "warning" | "danger" | "success";

export interface DesktopOfflineStatusSurfaceModel {
  readonly banner: {
    readonly tone: DesktopOfflineBannerTone;
    readonly title: string;
    readonly message: string;
  };
  readonly connectivity: {
    readonly label: string;
    readonly detail?: string;
    readonly stale: boolean;
    readonly lastChangedAtLabel: string;
  };
  readonly synchronization: {
    readonly stateLabel: string;
    readonly pendingCount: number;
    readonly conflictCount: number;
    readonly rejectedCount: number;
    readonly pendingRunSubmissionCount: number;
    readonly pendingExecutionRegistrationCount: number;
    readonly requiresAttention: boolean;
    readonly summary: string;
  };
  readonly drafts: {
    readonly unsyncedCount: number;
    readonly localOnlyCount: number;
    readonly queuedCount: number;
    readonly conflictCount: number;
    readonly rejectedCount: number;
    readonly summary: string;
    readonly preserved: ReadonlyArray<{
      readonly draftId: string;
      readonly resourceLabel: string;
      readonly syncStatusLabel: string;
      readonly localChangeCount: number;
      readonly lastEditedAtLabel: string;
      readonly recommendedAction: string;
    }>;
  };
  readonly conflicts: {
    readonly totalCount: number;
    readonly highSeverityCount: number;
    readonly summary: string;
    readonly entries: ReadonlyArray<{
      readonly key: string;
      readonly title: string;
      readonly summary: string;
      readonly severityLabel: string;
      readonly detectedAtLabel: string;
      readonly recommendedAction: string;
    }>;
  };
  readonly replayOutcomes: {
    readonly totalCount: number;
    readonly appliedCount: number;
    readonly reviewRequiredCount: number;
    readonly rejectedCount: number;
    readonly summary: string;
    readonly entries: ReadonlyArray<{
      readonly key: string;
      readonly title: string;
      readonly reason: string;
      readonly resolvedAtLabel: string;
      readonly recommendedAction: string;
    }>;
  };
  readonly cache: {
    readonly totalCount: number;
    readonly freshCount: number;
    readonly staleCount: number;
    readonly expiredCount: number;
    readonly summary: string;
  };
  readonly policy: {
    readonly unsupportedActions: ReadonlyArray<string>;
  };
  readonly actions: {
    readonly offlineModeToggleLabel: string;
    readonly refreshLabel: string;
  };
  readonly followUp: {
    readonly actions: ReadonlyArray<{
      readonly actionKey: "preserved-drafts" | "sync-conflicts" | "replay-outcomes";
      readonly label: string;
      readonly description: string;
      readonly enabled: boolean;
      readonly unavailableReason?: string;
    }>;
    readonly limitations: ReadonlyArray<string>;
  };
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return parsed.toLocaleString();
}

function buildBanner(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["banner"] {
  const { connectivity, status } = snapshot;
  const hasUnsyncedChanges = status.pendingOperationCount > 0
    || status.conflictCount > 0
    || status.rejectedCount > 0
    || snapshot.queue.pendingRunSubmissions.length > 0;

  if (connectivity.state === OfflineConnectivityStates.connected && hasUnsyncedChanges) {
    return Object.freeze({
      tone: "warning",
      title: "Connected with unsynced local changes",
      message: "Authoritative connectivity is available, but local queued work still needs reconciliation.",
    });
  }

  switch (connectivity.state) {
    case OfflineConnectivityStates.connected:
      return Object.freeze({
        tone: "success",
        title: "Connected to authoritative services",
        message: "Desktop state is online and can synchronize with the control plane.",
      });
    case OfflineConnectivityStates.reconnecting:
      return Object.freeze({
        tone: "info",
        title: "Reconnecting to authoritative services",
        message: connectivity.detail ?? "Transport recovery is in progress; local state remains bounded until reconnect completes.",
      });
    case OfflineConnectivityStates.degraded:
      return Object.freeze({
        tone: "warning",
        title: "Connectivity is degraded",
        message: connectivity.detail ?? "Some trusted session or transport prerequisites are unavailable.",
      });
    case OfflineConnectivityStates.disconnected:
      return Object.freeze({
        tone: "danger",
        title: connectivity.localModeActive ? "Offline local mode is active" : "Disconnected from authoritative services",
        message: connectivity.detail ?? "Only policy-limited local operations are available until trusted connectivity returns.",
      });
    default:
      return Object.freeze({
        tone: "neutral",
        title: "Connecting to authoritative services",
        message: "Connectivity status is being resolved.",
      });
  }
}

function buildConnectivityLabel(snapshot: OfflineSynchronizationStateSnapshotDto): string {
  const state = snapshot.connectivity.state;
  if (state === OfflineConnectivityStates.connected) {
    return "Online";
  }
  if (state === OfflineConnectivityStates.reconnecting) {
    return "Reconnecting";
  }
  if (state === OfflineConnectivityStates.degraded) {
    return "Degraded";
  }
  if (state === OfflineConnectivityStates.disconnected) {
    return snapshot.connectivity.localModeActive ? "Offline (local mode)" : "Offline";
  }
  return "Connecting";
}

function buildSynchronizationSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["synchronization"] {
  const pendingExecutionRegistrationCount = snapshot.queue.localExecutionRegistrations.filter((entry) => (
    entry.userVisibleRegistrationStatus === OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
  )).length;
  const pendingRunSubmissionCount = snapshot.queue.pendingRunSubmissions.length;
  const pendingCount = snapshot.status.pendingOperationCount;
  const conflictCount = snapshot.status.conflictCount;
  const rejectedCount = snapshot.status.rejectedCount;

  let stateLabel = "Idle";
  if (snapshot.status.state === OfflineSynchronizationStates.synchronizing) {
    stateLabel = "Synchronizing";
  } else if (snapshot.status.state === OfflineSynchronizationStates.blockedConflict) {
    stateLabel = "Blocked by conflicts";
  } else if (snapshot.status.state === OfflineSynchronizationStates.failed) {
    stateLabel = "Cannot synchronize";
  }

  const parts: string[] = [];
  if (pendingCount > 0) {
    parts.push(`${pendingCount} queued operation${pendingCount === 1 ? "" : "s"}`);
  }
  if (pendingExecutionRegistrationCount > 0) {
    parts.push(`${pendingExecutionRegistrationCount} pending local execution registration${pendingExecutionRegistrationCount === 1 ? "" : "s"}`);
  }
  if (pendingRunSubmissionCount > 0) {
    parts.push(`${pendingRunSubmissionCount} pending run submission${pendingRunSubmissionCount === 1 ? "" : "s"}`);
  }
  if (conflictCount > 0) {
    parts.push(`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`);
  }
  if (rejectedCount > 0) {
    parts.push(`${rejectedCount} rejected operation${rejectedCount === 1 ? "" : "s"}`);
  }

  return Object.freeze({
    stateLabel,
    pendingCount,
    conflictCount,
    rejectedCount,
    pendingRunSubmissionCount,
    pendingExecutionRegistrationCount,
    requiresAttention: conflictCount > 0 || rejectedCount > 0,
    summary: parts.length > 0 ? parts.join(", ") : "No pending local synchronization work.",
  });
}

function buildDraftStatusLabel(syncStatus: string): string {
  switch (syncStatus) {
    case OfflineDraftSyncStatuses.localOnly:
      return "Local only";
    case OfflineDraftSyncStatuses.queuedPendingSync:
      return "Queued for replay";
    case OfflineDraftSyncStatuses.syncConflict:
      return "Conflict needs review";
    case OfflineDraftSyncStatuses.syncRejected:
      return "Rejected for replay";
    case OfflineDraftSyncStatuses.syncApplied:
      return "Applied";
    default:
      return "Unknown";
  }
}

function buildPreservedDraftRecommendedAction(syncStatus: string): string {
  switch (syncStatus) {
    case OfflineDraftSyncStatuses.syncConflict:
      return "Review authoritative changes, then prepare a new queued update from this draft.";
    case OfflineDraftSyncStatuses.syncRejected:
      return "Create a fresh local revision before attempting another authoritative update.";
    case OfflineDraftSyncStatuses.queuedPendingSync:
      return "Keep this draft queued; it will replay when trusted connectivity is available.";
    case OfflineDraftSyncStatuses.localOnly:
    default:
      return "Queue this draft when you are ready to synchronize it with authoritative state.";
  }
}

function buildDraftRecoverySummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["drafts"] {
  const unsyncedDrafts = snapshot.drafts
    .filter((draft) => draft.syncStatus !== OfflineDraftSyncStatuses.syncApplied);
  const localOnlyCount = unsyncedDrafts.filter((draft) => draft.syncStatus === OfflineDraftSyncStatuses.localOnly).length;
  const queuedCount = unsyncedDrafts.filter((draft) => draft.syncStatus === OfflineDraftSyncStatuses.queuedPendingSync).length;
  const conflictCount = unsyncedDrafts.filter((draft) => draft.syncStatus === OfflineDraftSyncStatuses.syncConflict).length;
  const rejectedCount = unsyncedDrafts.filter((draft) => draft.syncStatus === OfflineDraftSyncStatuses.syncRejected).length;

  const preserved = Object.freeze(
    [...unsyncedDrafts]
      .sort((left, right) => new Date(right.lastEditedAt).getTime() - new Date(left.lastEditedAt).getTime())
      .slice(0, 5)
      .map((draft) => Object.freeze({
        draftId: draft.draftId,
        resourceLabel: `${draft.resourceClass} ${draft.resourceId}`,
        syncStatusLabel: buildDraftStatusLabel(draft.syncStatus),
        localChangeCount: draft.localChanges.length,
        lastEditedAtLabel: formatTimestamp(draft.lastEditedAt),
        recommendedAction: buildPreservedDraftRecommendedAction(draft.syncStatus),
      })),
  );

  const summaryParts: string[] = [];
  if (localOnlyCount > 0) {
    summaryParts.push(`${localOnlyCount} local-only`);
  }
  if (queuedCount > 0) {
    summaryParts.push(`${queuedCount} queued`);
  }
  if (conflictCount > 0) {
    summaryParts.push(`${conflictCount} conflicted`);
  }
  if (rejectedCount > 0) {
    summaryParts.push(`${rejectedCount} rejected`);
  }

  return Object.freeze({
    unsyncedCount: unsyncedDrafts.length,
    localOnlyCount,
    queuedCount,
    conflictCount,
    rejectedCount,
    summary: unsyncedDrafts.length < 1
      ? "No preserved unsynced drafts are waiting for review."
      : `${unsyncedDrafts.length} preserved unsynced draft${unsyncedDrafts.length === 1 ? "" : "s"} (${summaryParts.join(", ")}).`,
    preserved,
  });
}

function buildConflictSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["conflicts"] {
  const entries: Array<DesktopOfflineStatusSurfaceModel["conflicts"]["entries"][number] & { readonly sortAt: number }> = [];
  const conflictOutcomeOperationIds = new Set<string>();

  for (const outcome of snapshot.queue.outcomes) {
    for (const conflict of outcome.conflicts ?? []) {
      conflictOutcomeOperationIds.add(outcome.operationId);
      entries.push(Object.freeze({
        key: `outcome:${outcome.operationId}:${conflict.conflictCode}`,
        title: `${conflict.resourceClass} ${conflict.resourceId}`,
        summary: conflict.summary,
        severityLabel: conflict.severity,
        detectedAtLabel: formatTimestamp(conflict.detectedAt),
        recommendedAction: "Conflicts are preserved for manual review; unsupported auto-merge paths are intentionally not attempted.",
        sortAt: new Date(conflict.detectedAt).getTime(),
      }));
    }
  }

  for (const operation of snapshot.queue.operations) {
    if (operation.userVisibleSyncStatus !== OfflinePendingOperationStatuses.syncConflict) {
      continue;
    }
    if (conflictOutcomeOperationIds.has(operation.operationId)) {
      continue;
    }
    entries.push(Object.freeze({
      key: `operation:${operation.operationId}`,
      title: `${operation.targetResourceClass} ${operation.targetResourceId}`,
      summary: "Queued operation is blocked by a replay conflict and was retained for review.",
      severityLabel: "high",
      detectedAtLabel: formatTimestamp(operation.lastAttemptedAt ?? operation.queuedAt),
      recommendedAction: "Inspect authoritative state and draft differences, then submit a new explicit update.",
      sortAt: new Date(operation.lastAttemptedAt ?? operation.queuedAt).getTime(),
    }));
  }

  for (const registration of snapshot.queue.localExecutionRegistrations) {
    if (registration.userVisibleRegistrationStatus !== OfflineLocalExecutionRegistrationStatuses.registrationConflict) {
      continue;
    }
    entries.push(Object.freeze({
      key: `registration:${registration.registrationId}`,
      title: `${registration.execution.resourceClass} ${registration.execution.resourceId}`,
      summary: "Local execution registration conflicted during reconnect and requires manual follow-up.",
      severityLabel: "medium",
      detectedAtLabel: formatTimestamp(registration.lastAttemptedAt ?? registration.queuedAt),
      recommendedAction: "Review registration context and retry with updated authoritative context if still valid.",
      sortAt: new Date(registration.lastAttemptedAt ?? registration.queuedAt).getTime(),
    }));
  }

  entries.sort((left, right) => right.sortAt - left.sortAt);

  const highSeverityCount = entries.filter((entry) => entry.severityLabel === "high").length;
  return Object.freeze({
    totalCount: entries.length,
    highSeverityCount,
    summary: entries.length < 1
      ? "No sync conflicts are currently preserved."
      : `${entries.length} conflict${entries.length === 1 ? "" : "s"} preserved for explicit review.`,
    entries: Object.freeze(entries.slice(0, 5).map((entry) => Object.freeze({
      key: entry.key,
      title: entry.title,
      summary: entry.summary,
      severityLabel: entry.severityLabel,
      detectedAtLabel: entry.detectedAtLabel,
      recommendedAction: entry.recommendedAction,
    }))),
  });
}

function buildReplayOutcomeTitle(action: string): string {
  switch (action) {
    case OfflineReconciliationActions.applyToAuthoritative:
      return "Applied to authoritative state";
    case OfflineReconciliationActions.conflictRequiresReview:
      return "Conflict preserved for review";
    case OfflineReconciliationActions.rejectNotAllowed:
      return "Replay rejected";
    default:
      return "Replay outcome recorded";
  }
}

function buildReplayOutcomeAction(outcome: OfflineSynchronizationStateSnapshotDto["queue"]["outcomes"][number]): string {
  if (outcome.action === OfflineReconciliationActions.applyToAuthoritative) {
    return "No follow-up is needed unless additional local changes are pending.";
  }
  if (outcome.action === OfflineReconciliationActions.conflictRequiresReview) {
    return outcome.preserveLocalDraftAsUnsynced
      ? "Use the preserved unsynced draft to prepare an explicit follow-up update."
      : "Review authoritative state and create a new local draft before retry.";
  }
  return outcome.requiresAdminAttention
    ? "Replay was rejected; request admin review before retrying with a new change."
    : "Replay was rejected; revise local intent and resubmit from current authoritative state.";
}

function buildReplayOutcomeSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["replayOutcomes"] {
  const outcomes = [...snapshot.queue.outcomes]
    .sort((left, right) => new Date(right.resolvedAt).getTime() - new Date(left.resolvedAt).getTime());

  const appliedCount = outcomes.filter((entry) => entry.action === OfflineReconciliationActions.applyToAuthoritative).length;
  const reviewRequiredCount = outcomes.filter((entry) => entry.action === OfflineReconciliationActions.conflictRequiresReview).length;
  const rejectedCount = outcomes.filter((entry) => entry.action === OfflineReconciliationActions.rejectNotAllowed).length;

  const entries = Object.freeze(
    outcomes.slice(0, 5).map((outcome) => Object.freeze({
      key: `outcome:${outcome.operationId}:${outcome.resolvedAt}`,
      title: buildReplayOutcomeTitle(outcome.action),
      reason: outcome.reason,
      resolvedAtLabel: formatTimestamp(outcome.resolvedAt),
      recommendedAction: buildReplayOutcomeAction(outcome),
    })),
  );

  const summaryParts: string[] = [];
  if (appliedCount > 0) {
    summaryParts.push(`${appliedCount} applied`);
  }
  if (reviewRequiredCount > 0) {
    summaryParts.push(`${reviewRequiredCount} preserved for review`);
  }
  if (rejectedCount > 0) {
    summaryParts.push(`${rejectedCount} rejected`);
  }

  return Object.freeze({
    totalCount: outcomes.length,
    appliedCount,
    reviewRequiredCount,
    rejectedCount,
    summary: outcomes.length < 1
      ? "No replay outcomes are available yet."
      : `${outcomes.length} reconnect replay outcome${outcomes.length === 1 ? "" : "s"} (${summaryParts.join(", ")}).`,
    entries,
  });
}

function buildCacheSummary(snapshot: OfflineSynchronizationStateSnapshotDto): DesktopOfflineStatusSurfaceModel["cache"] {
  const freshCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.fresh).length;
  const staleCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.stale).length;
  const expiredCount = snapshot.cachedResources.filter((item) => item.freshness === OfflineCacheFreshnessStates.expired).length;
  const totalCount = snapshot.cachedResources.length;

  const summary = totalCount === 0
    ? "No authoritative resources are currently cached on this desktop."
    : `${freshCount} fresh, ${staleCount} stale, ${expiredCount} expired cached resources.`;

  return Object.freeze({
    totalCount,
    freshCount,
    staleCount,
    expiredCount,
    summary,
  });
}

function buildUnsupportedActions(snapshot: OfflineSynchronizationStateSnapshotDto): ReadonlyArray<string> {
  const unsupported: string[] = [];
  if (!snapshot.connectivity.canQueueOperations) {
    unsupported.push("Authoritative write operations cannot be queued in the current connectivity state.");
  }
  if (!snapshot.connectivity.canResynchronize) {
    unsupported.push("Resynchronization is unavailable until trusted authoritative connectivity is restored.");
  }
  if (snapshot.status.state === OfflineSynchronizationStates.blockedConflict) {
    unsupported.push("Conflicts must be reviewed before replay can continue.");
  }
  if (snapshot.status.rejectedCount > 0) {
    unsupported.push("Rejected operations require manual intervention before retry.");
  }
  return Object.freeze(unsupported);
}

function buildFollowUpModel(input: {
  readonly snapshot: OfflineSynchronizationStateSnapshotDto;
  readonly drafts: DesktopOfflineStatusSurfaceModel["drafts"];
  readonly conflicts: DesktopOfflineStatusSurfaceModel["conflicts"];
  readonly replayOutcomes: DesktopOfflineStatusSurfaceModel["replayOutcomes"];
}): DesktopOfflineStatusSurfaceModel["followUp"] {
  const actions = Object.freeze([
    Object.freeze({
      actionKey: "preserved-drafts" as const,
      label: "Review preserved drafts",
      description: "Inspect unsynced local drafts and decide whether to queue, revise, or discard them.",
      enabled: input.drafts.unsyncedCount > 0,
      unavailableReason: input.drafts.unsyncedCount > 0 ? undefined : "No preserved unsynced drafts are currently available.",
    }),
    Object.freeze({
      actionKey: "sync-conflicts" as const,
      label: "Inspect sync conflicts",
      description: "Review reconnect conflicts retained for explicit user/admin intervention.",
      enabled: input.conflicts.totalCount > 0,
      unavailableReason: input.conflicts.totalCount > 0 ? undefined : "No conflicts are currently retained for review.",
    }),
    Object.freeze({
      actionKey: "replay-outcomes" as const,
      label: "Review replay outcomes",
      description: "Understand what replay applied, what was rejected, and what remains unresolved.",
      enabled: input.replayOutcomes.totalCount > 0,
      unavailableReason: input.replayOutcomes.totalCount > 0 ? undefined : "No reconnect replay outcomes are available yet.",
    }),
  ]);

  const limitations: string[] = [];
  if (input.conflicts.totalCount > 0 || input.drafts.conflictCount > 0) {
    limitations.push("Unsupported auto-merge scenarios remain manual: the desktop preserves conflicts and does not silently merge divergent branches.");
  }
  if (input.drafts.rejectedCount > 0 || input.replayOutcomes.rejectedCount > 0) {
    limitations.push("Rejected operations are retained for explicit follow-up and are not auto-replayed.");
  }
  if (!input.snapshot.connectivity.canResynchronize && input.snapshot.status.pendingOperationCount > 0) {
    limitations.push("Pending operations remain local until trusted authoritative connectivity supports controlled replay.");
  }

  return Object.freeze({
    actions,
    limitations: Object.freeze(limitations),
  });
}

export function buildDesktopOfflineStatusSurfaceModel(
  snapshot: OfflineSynchronizationStateSnapshotDto,
): DesktopOfflineStatusSurfaceModel {
  const drafts = buildDraftRecoverySummary(snapshot);
  const conflicts = buildConflictSummary(snapshot);
  const replayOutcomes = buildReplayOutcomeSummary(snapshot);
  return Object.freeze({
    banner: buildBanner(snapshot),
    connectivity: Object.freeze({
      label: buildConnectivityLabel(snapshot),
      detail: snapshot.connectivity.detail,
      stale: snapshot.connectivity.stale,
      lastChangedAtLabel: formatTimestamp(snapshot.connectivity.lastChangedAt),
    }),
    synchronization: buildSynchronizationSummary(snapshot),
    drafts,
    conflicts,
    replayOutcomes,
    cache: buildCacheSummary(snapshot),
    policy: Object.freeze({
      unsupportedActions: buildUnsupportedActions(snapshot),
    }),
    actions: Object.freeze({
      offlineModeToggleLabel: snapshot.connectivity.localModeActive ? "Return online" : "Go offline",
      refreshLabel: "Refresh status",
    }),
    followUp: buildFollowUpModel({
      snapshot,
      drafts,
      conflicts,
      replayOutcomes,
    }),
  });
}
